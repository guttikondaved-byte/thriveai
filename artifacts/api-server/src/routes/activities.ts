import { Router, type Request, type IRouter } from "express";
import { eq, and, desc, gte, inArray } from "drizzle-orm";
import {
  db,
  activitiesTable,
  athleteProfileTable,
  injuryAlertsTable,
  trainingPlansTable,
  planSessionsTable,
  usersTable,
  teamMembershipsTable,
  teamsTable,
  teamCoachesTable,
} from "@workspace/db";
import {
  ListActivitiesResponse,
  CreateActivityBody,
  GetActivityParams,
  GetActivityResponse,
  ListActivitiesQueryParams,
} from "@workspace/api-zod";
import { assessInjuryRisk } from "../lib/injuryRiskCalculator";
import { findBestSessionMatch } from "../lib/trainingCompletion";
import { sendInjuryAlertEmail } from "../lib/email";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function numOrNull(v: string | null): number | null {
  return v === null || v === undefined ? null : Number(v);
}

function serializeActivity(a: typeof activitiesTable.$inferSelect) {
  return {
    ...a,
    distanceKm: numOrNull(a.distanceKm),
    elevationGainM: numOrNull(a.elevationGainM),
    elevHighM: numOrNull(a.elevHighM),
    elevLowM: numOrNull(a.elevLowM),
    avgCadence: numOrNull(a.avgCadence),
    avgSpeed: numOrNull(a.avgSpeed),
    maxSpeed: numOrNull(a.maxSpeed),
    calories: numOrNull(a.calories),
    avgWatts: numOrNull(a.avgWatts),
    createdAt: a.createdAt.toISOString(),
  };
}

/**
 * Emails a new injury alert to the athlete themselves and, if they're on a
 * team, their coach(es) — primary coach plus any co-coaches. Best-effort:
 * missing emails or no team are silently skipped, not treated as errors.
 */
async function emailInjuryAlertRecipients(
  athleteUserId: string,
  bodyPart: string,
  riskLevel: string,
  message: string,
  recommendation: string,
): Promise<void> {
  const [athleteUser] = await db
    .select({ email: usersTable.email, firstName: usersTable.firstName })
    .from(usersTable)
    .where(eq(usersTable.id, athleteUserId))
    .limit(1);
  const [athleteProfile] = await db
    .select({ name: athleteProfileTable.name })
    .from(athleteProfileTable)
    .where(eq(athleteProfileTable.userId, athleteUserId))
    .limit(1);

  const athleteName =
    athleteProfile?.name && athleteProfile.name.toLowerCase() !== "athlete"
      ? athleteProfile.name
      : athleteUser?.firstName || "Athlete";

  const emailPromises: Promise<void>[] = [];

  if (athleteUser?.email) {
    emailPromises.push(
      sendInjuryAlertEmail({
        to: athleteUser.email,
        recipientName: athleteUser.firstName || athleteName,
        athleteName,
        isAthlete: true,
        bodyPart,
        riskLevel,
        message,
        recommendation,
      }),
    );
  }

  const memberships = await db
    .select({ teamId: teamMembershipsTable.teamId })
    .from(teamMembershipsTable)
    .where(eq(teamMembershipsTable.athleteUserId, athleteUserId));

  if (memberships.length > 0) {
    const teamIds = memberships.map((m) => m.teamId);
    const [teams, coCoaches] = await Promise.all([
      db.select({ coachUserId: teamsTable.coachUserId }).from(teamsTable).where(inArray(teamsTable.id, teamIds)),
      db.select({ coachUserId: teamCoachesTable.coachUserId }).from(teamCoachesTable).where(inArray(teamCoachesTable.teamId, teamIds)),
    ]);
    const coachUserIds = Array.from(new Set([...teams.map((t) => t.coachUserId), ...coCoaches.map((c) => c.coachUserId)]));

    if (coachUserIds.length > 0) {
      const coachUsers = await db
        .select({ email: usersTable.email, firstName: usersTable.firstName })
        .from(usersTable)
        .where(inArray(usersTable.id, coachUserIds));

      for (const coach of coachUsers) {
        if (!coach.email) continue;
        emailPromises.push(
          sendInjuryAlertEmail({
            to: coach.email,
            recipientName: coach.firstName || "Coach",
            athleteName,
            isAthlete: false,
            bodyPart,
            riskLevel,
            message,
            recommendation,
          }),
        );
      }
    }
  }

  await Promise.all(emailPromises);
}

router.get("/activities", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const query = ListActivitiesQueryParams.safeParse(req.query);
  const limit = query.success ? (query.data.limit ?? 20) : 20;
  const date = query.success ? query.data.date : undefined;
  const userId = req.user.id;
  const where = date
    ? and(eq(activitiesTable.userId, userId), eq(activitiesTable.activityDate, date))
    : eq(activitiesTable.userId, userId);
  const activities = await db
    .select()
    .from(activitiesTable)
    .where(where)
    .orderBy(desc(activitiesTable.activityDate))
    .limit(limit);
  res.json(ListActivitiesResponse.parse(activities.map(serializeActivity)));
});

router.post("/activities", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CreateActivityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user.id;
  const insertData: Record<string, unknown> = {
    userId,
    type: parsed.data.type,
    activityDate: parsed.data.activityDate,
  };
  if (parsed.data.distanceKm !== undefined) insertData.distanceKm = String(parsed.data.distanceKm);
  if (parsed.data.durationMinutes !== undefined) insertData.durationMinutes = parsed.data.durationMinutes;
  if (parsed.data.avgHeartRate !== undefined) insertData.avgHeartRate = parsed.data.avgHeartRate;
  if (parsed.data.perceivedEffort !== undefined) insertData.perceivedEffort = parsed.data.perceivedEffort;
  if (parsed.data.notes !== undefined) insertData.notes = parsed.data.notes;

  const [activity] = await db.insert(activitiesTable).values(insertData as Parameters<typeof db.insert>[0] extends { values: (v: infer V) => unknown } ? V : never).returning();

  // ── Assess injury risk ──
  try {
    const [athleteProfile, recentActivities] = await Promise.all([
      db.select().from(athleteProfileTable).where(eq(athleteProfileTable.userId, userId)).limit(1),
      db
        .select()
        .from(activitiesTable)
        .where(and(eq(activitiesTable.userId, userId), gte(activitiesTable.activityDate, getDateNDaysAgo(7))))
        .orderBy(desc(activitiesTable.activityDate)),
    ]);

    const profile = athleteProfile[0] || null;

    // Calculate previous week's distance (before this activity)
    const weekAgo = getDateNDaysAgo(14);
    const prevWeekActivities = recentActivities.filter(
      (a) => a.activityDate && a.activityDate >= weekAgo && a.activityDate < getDateNDaysAgo(7),
    );
    const previousWeekKm = prevWeekActivities.reduce((sum, a) => sum + (a.distanceKm ? Number(a.distanceKm) : 0), 0);

    const assessment = await assessInjuryRisk(activity, profile, previousWeekKm, recentActivities);

    // Log the assessment with risk factors for debugging
    logger.info(
      {
        userId,
        activityId: activity.id,
        riskLevel: assessment.riskLevel,
        riskScore: assessment.riskScore,
        factorCount: assessment.riskFactors.length,
        factors: assessment.riskFactors.map((f) => ({
          factor: f.factor,
          severity: f.severity,
          value: f.value,
        })),
      },
      "Injury risk assessment completed",
    );

    // Create alerts if risk is detected
    if (assessment.riskLevel !== "low") {
      // Check if we already have an unacknowledged alert for this user and body part (avoid duplicates)
      const existingAlerts = await db
        .select()
        .from(injuryAlertsTable)
        .where(
          and(
            eq(injuryAlertsTable.userId, userId),
            eq(injuryAlertsTable.acknowledged, false),
          ),
        );

      // Determine primary body part
      const bodyPart = assessment.primaryBodyParts[0] || "general";

      // Only create alert if we don't have a recent one for the same body part
      const recentSameBodyPart = existingAlerts.filter((a) => a.bodyPart.toLowerCase().includes(bodyPart.toLowerCase()));

      if (recentSameBodyPart.length === 0) {
        // Build detailed message with risk factors
        const factorSummary = assessment.riskFactors
          .map((f) => `• **${f.factor}** (${f.severity}): ${f.value}`)
          .join("\n");

        const detailedMessage =
          assessment.riskFactors.length > 0
            ? `${assessment.message}\n\n**Risk Factors:**\n${factorSummary}`
            : assessment.message;

        await db.insert(injuryAlertsTable).values({
          userId,
          riskLevel: assessment.riskLevel,
          bodyPart,
          message: detailedMessage,
          recommendation: assessment.recommendation,
        });

        logger.info(
          { userId, activityId: activity.id, riskLevel: assessment.riskLevel, bodyPart },
          "Injury alert created",
        );

        // Email the athlete and their coach(es), if any. Best-effort — a
        // flaky email provider should never break activity creation, so
        // this isn't awaited into the outer try/catch's failure path.
        emailInjuryAlertRecipients(userId, bodyPart, assessment.riskLevel, detailedMessage, assessment.recommendation)
          .catch((err) => logger.error({ err, userId }, "Failed to email injury alert recipients"));
      }
    }
  } catch (err) {
    // Don't fail the activity creation if risk assessment fails
    logger.error({ err, userId, activityId: activity.id }, "Injury risk assessment failed");
  }

  // ── Auto-match activity to training plan sessions ──
  try {
    // Fetch active training plans for this user
    const activePlans = await db
      .select()
      .from(trainingPlansTable)
      .where(and(eq(trainingPlansTable.userId, userId), eq(trainingPlansTable.status, "active")));

    if (activePlans.length > 0) {
      // For each active plan, try to match this activity to an uncompleted session
      for (const plan of activePlans) {
        const sessions = await db
          .select()
          .from(planSessionsTable)
          .where(eq(planSessionsTable.planId, plan.id));

        // Calculate scheduled dates for each session
        const startDate = new Date(plan.startDate);
        const sessionsWithDates = sessions.map((s) => {
          const sessionDate = new Date(startDate);
          sessionDate.setDate(sessionDate.getDate() + (s.weekNumber - 1) * 7 + (s.dayOfWeek - 1));
          return { ...s, scheduledDate: sessionDate };
        });

        // Find best matching uncompleted session
        const bestMatch = findBestSessionMatch(activity, sessionsWithDates, 60); // 60 = good match threshold

        if (bestMatch && bestMatch.matchScore >= 60) {
          // Mark session as complete
          await db
            .update(planSessionsTable)
            .set({ completed: true })
            .where(eq(planSessionsTable.id, bestMatch.sessionId));

          logger.info(
            {
              userId,
              activityId: activity.id,
              planId: plan.id,
              sessionId: bestMatch.sessionId,
              matchScore: bestMatch.matchScore,
              reasons: bestMatch.matchReasons,
            },
            "Activity auto-matched to training session",
          );

          // Only match to first plan (don't mark same activity for multiple plans)
          break;
        }
      }
    }
  } catch (err) {
    // Don't fail the activity creation if training matching fails
    logger.error({ err, userId, activityId: activity.id }, "Training session matching failed");
  }

  res.status(201).json(GetActivityResponse.parse(serializeActivity(activity)));
});

/**
 * Helper to get ISO date string N days ago
 */
function getDateNDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

router.get("/activities/:id", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetActivityParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.user.id;
  const [activity] = await db
    .select()
    .from(activitiesTable)
    .where(and(eq(activitiesTable.id, params.data.id), eq(activitiesTable.userId, userId)));
  if (!activity) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }
  res.json(GetActivityResponse.parse(serializeActivity(activity)));
});

export default router;

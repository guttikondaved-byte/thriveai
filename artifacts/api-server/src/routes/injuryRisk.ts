import { Router, type Request, type IRouter } from "express";
import { eq, and, desc, gte } from "drizzle-orm";
import {
  db,
  activitiesTable,
  athleteProfileTable,
  injuryAlertsTable,
  sorenessLogsTable,
  teamsTable,
  teamMembershipsTable,
  notificationsTable,
} from "@workspace/db";
import { GetInjuryRiskDashboardResponse, GetInjuryRiskIntensityMapResponse, GetInjuryRiskWhatIfResponse, CreateSorenessEntryBody } from "@workspace/api-zod";
import { assessInjuryRisk } from "../lib/injuryRiskCalculator";
import { computeWorkloadRatio, buildMonthlyIntensityMap, maxDailyLoad } from "../lib/workloadRatio";
import { computeRiskIndex, acwrComponentFor, bandFor, type RiskBand } from "../lib/riskIndex";
import {
  computeWeeklyRelativeEffort,
  computeActivityConsistency,
  computeFitnessTrend,
  computeHeartRateZones,
  computeSegments,
} from "../lib/stravaMetrics";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function getDateNDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

function buildInsight(riskBand: RiskBand, ratio: number | null, maxRecentSoreness: number | null): string {
  if (riskBand === "critical") {
    return "Multiple risk factors are elevated right now. Prioritize rest and consider checking in with your coach before your next hard session.";
  }
  if (ratio !== null && ratio > 1.3) {
    return `Your workload ratio is elevated at ${ratio.toFixed(2)} — acute load is outpacing your usual training. Consider swapping tomorrow's session for an easy day or cross-training.`;
  }
  if (maxRecentSoreness !== null && maxRecentSoreness >= 6) {
    return `You've reported meaningful soreness recently (${maxRecentSoreness}/10). Give the affected area extra recovery before your next hard effort.`;
  }
  if (riskBand === "moderate") {
    return "A few risk signals are trending up. Keep an eye on recovery markers and avoid stacking hard days back-to-back.";
  }
  return "Your training load and recovery markers look balanced. Continue with your current plan.";
}

/**
 * Computes the full injury-risk dashboard for a given user. Shared by the
 * athlete's own /injury-risk/dashboard and the coach-scoped team route below,
 * so the two can never compute this differently.
 */
export async function computeInjuryRiskDashboard(userId: string) {
  const [profileRows, activities, allActivities, openAlerts, recentSoreness] = await Promise.all([
    db.select().from(athleteProfileTable).where(eq(athleteProfileTable.userId, userId)).limit(1),
    // 40 days covers the 30-day fitness trend (which needs a 7-day trailing tail).
    db
      .select()
      .from(activitiesTable)
      .where(and(eq(activitiesTable.userId, userId), gte(activitiesTable.activityDate, getDateNDaysAgo(40))))
      .orderBy(desc(activitiesTable.activityDate)),
    // Full history so segment "PR" comparisons are genuinely all-time.
    db
      .select()
      .from(activitiesTable)
      .where(eq(activitiesTable.userId, userId))
      .orderBy(desc(activitiesTable.activityDate)),
    db
      .select()
      .from(injuryAlertsTable)
      .where(and(eq(injuryAlertsTable.userId, userId), eq(injuryAlertsTable.acknowledged, false)))
      .orderBy(desc(injuryAlertsTable.createdAt)),
    db
      .select()
      .from(sorenessLogsTable)
      .where(and(eq(sorenessLogsTable.userId, userId), gte(sorenessLogsTable.loggedDate, getDateNDaysAgo(13))))
      .orderBy(desc(sorenessLogsTable.createdAt)),
  ]);

  const profile = profileRows[0] ?? null;

  // Estimated HRmax: age-based (220 − age) when available, else the highest
  // observed max HR across all synced runs, else a sane default.
  const observedMaxHr = Math.max(0, ...allActivities.map((a) => a.maxHeartRate ?? 0));
  const hrMax = profile?.age ? 220 - profile.age : observedMaxHr > 0 ? observedMaxHr : 190;

  const weeklyRelativeEffort = computeWeeklyRelativeEffort(activities);
  const activityConsistency = computeActivityConsistency(activities);
  const fitnessTrend = computeFitnessTrend(activities);
  const heartRateZones = computeHeartRateZones(activities, hrMax);
  const segments = computeSegments(allActivities);

  const workload = computeWorkloadRatio(activities);
  // Score this month's days against the athlete's all-time hardest day so the
  // 0-100 intensity scores are comparable across every month of their history.
  const allTimeMaxDailyLoad = maxDailyLoad(allActivities);
  const intensityMap = buildMonthlyIntensityMap(activities, undefined, undefined, allTimeMaxDailyLoad);

  // Recompute recent per-activity risk scores using the existing pure calculator,
  // mirroring the same 7-day/previous-week windows used when an activity is first logged.
  const recentActivities = activities.filter((a) => a.activityDate && a.activityDate >= getDateNDaysAgo(7));
  const prevWeekActivities = activities.filter(
    (a) => a.activityDate && a.activityDate >= getDateNDaysAgo(14) && a.activityDate < getDateNDaysAgo(7),
  );
  const previousWeekKm = prevWeekActivities.reduce((sum, a) => sum + (a.distanceKm ? Number(a.distanceKm) : 0), 0);

  const recentActivityRiskScores: number[] = [];
  for (const activity of recentActivities) {
    try {
      const assessment = await assessInjuryRisk(activity, profile, previousWeekKm, recentActivities);
      recentActivityRiskScores.push(assessment.riskScore);
    } catch (err) {
      logger.error({ err, userId, activityId: activity.id }, "Injury risk recompute failed for dashboard");
    }
  }

  const maxRecentSoreness = recentSoreness.length > 0 ? Math.max(...recentSoreness.map((s) => s.painScore)) : null;

  const risk = computeRiskIndex({
    recentActivityRiskScores,
    acwr: workload.ratio,
    openAlertRiskLevels: openAlerts.map((a) => a.riskLevel),
    recentMaxSorenessScore: maxRecentSoreness,
  });

  const timestamps = [
    ...activities.map((a) => a.createdAt),
    ...openAlerts.map((a) => a.createdAt),
    ...recentSoreness.map((s) => s.createdAt),
  ];
  const lastUpdated =
    timestamps.length > 0 ? new Date(Math.max(...timestamps.map((d) => d.getTime()))) : new Date();

  return GetInjuryRiskDashboardResponse.parse({
    riskScore: risk.score,
    riskBand: risk.band,
    riskLabel: risk.label,
    insight: buildInsight(risk.band, workload.ratio, maxRecentSoreness),
    lastUpdated: lastUpdated.toISOString(),
    workload,
    hrvCurrent: profile?.hrv ? Number(profile.hrv) : null,
    intensityMap,
    weeklyRelativeEffort,
    activityConsistency,
    fitnessTrend,
    heartRateZones,
    segments,
    alerts: openAlerts.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    soreness: recentSoreness.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
  });
}

const WHAT_IF_DELTA_KM = [-10, -5, 0, 5, 10, 15, 20];

/**
 * "What if I ran N km more/less this week?" — recomputes the ACWR-driven
 * slice of the risk score for a range of hypothetical weekly-mileage deltas,
 * holding the other score components (recent-run analysis, open alerts,
 * soreness) fixed at their current values. Reuses the exact same
 * acwrComponentFor/bandFor math as the real dashboard score so the "current"
 * scenario always matches what the athlete sees elsewhere — it's not a
 * separately-tuned approximation.
 */
export async function computeWhatIfScenarios(userId: string) {
  const [profileRows, activities, openAlerts, recentSoreness] = await Promise.all([
    db.select().from(athleteProfileTable).where(eq(athleteProfileTable.userId, userId)).limit(1),
    db
      .select()
      .from(activitiesTable)
      .where(and(eq(activitiesTable.userId, userId), gte(activitiesTable.activityDate, getDateNDaysAgo(27))))
      .orderBy(desc(activitiesTable.activityDate)),
    db
      .select()
      .from(injuryAlertsTable)
      .where(and(eq(injuryAlertsTable.userId, userId), eq(injuryAlertsTable.acknowledged, false)))
      .orderBy(desc(injuryAlertsTable.createdAt)),
    db
      .select()
      .from(sorenessLogsTable)
      .where(and(eq(sorenessLogsTable.userId, userId), gte(sorenessLogsTable.loggedDate, getDateNDaysAgo(13))))
      .orderBy(desc(sorenessLogsTable.createdAt)),
  ]);

  const profile = profileRows[0] ?? null;
  const workload = computeWorkloadRatio(activities);

  const recentActivities = activities.filter((a) => a.activityDate && a.activityDate >= getDateNDaysAgo(7));
  const prevWeekActivities = activities.filter(
    (a) => a.activityDate && a.activityDate >= getDateNDaysAgo(14) && a.activityDate < getDateNDaysAgo(7),
  );
  const previousWeekKm = prevWeekActivities.reduce((sum, a) => sum + (a.distanceKm ? Number(a.distanceKm) : 0), 0);
  const actualWeeklyKm = recentActivities.reduce((sum, a) => sum + (a.distanceKm ? Number(a.distanceKm) : 0), 0);

  const recentActivityRiskScores: number[] = [];
  for (const activity of recentActivities) {
    try {
      const assessment = await assessInjuryRisk(activity, profile, previousWeekKm, recentActivities);
      recentActivityRiskScores.push(assessment.riskScore);
    } catch (err) {
      logger.error({ err, userId, activityId: activity.id }, "Injury risk recompute failed for what-if");
    }
  }
  const activityComponent =
    recentActivityRiskScores.length > 0
      ? recentActivityRiskScores.reduce((sum, s) => sum + s, 0) / recentActivityRiskScores.length
      : 0;

  const alertsComponent = openAlerts.reduce(
    (max, a) => Math.max(max, { low: 10, medium: 25, high: 45, critical: 70 }[a.riskLevel] ?? 0),
    0,
  );
  const maxRecentSoreness = recentSoreness.length > 0 ? Math.max(...recentSoreness.map((s) => s.painScore)) : null;
  const sorenessComponent = maxRecentSoreness !== null ? (maxRecentSoreness / 10) * 100 : 0;

  // Load-per-km ratio for this athlete's own week, so a hypothetical +/- km
  // delta scales acute load the same way their actual training does. Falls
  // back to the distance-only session-load estimate (10 per km) used
  // elsewhere when there's no mileage yet to derive a ratio from.
  const loadPerKm = actualWeeklyKm > 0 ? workload.acuteLoad / actualWeeklyKm : 10;

  const scenarios = WHAT_IF_DELTA_KM.map((deltaKm) => {
    const hypotheticalWeeklyKm = Math.max(0, actualWeeklyKm + deltaKm);
    const hypotheticalAcuteLoad = Math.max(0, workload.acuteLoad + deltaKm * loadPerKm);
    const hypotheticalRatio =
      workload.ratio !== null && workload.chronicWeeklyAvg > 0
        ? Math.round((hypotheticalAcuteLoad / workload.chronicWeeklyAvg) * 100) / 100
        : null;
    const acwrComponent = acwrComponentFor(hypotheticalRatio);
    const score = Math.round(
      Math.min(100, Math.max(0, activityComponent * 0.45 + acwrComponent * 0.25 + alertsComponent * 0.2 + sorenessComponent * 0.1)),
    );
    const { band, label } = bandFor(score);
    return { deltaKm, weeklyKm: Math.round(hypotheticalWeeklyKm * 10) / 10, ratio: hypotheticalRatio, score, band, label };
  });

  return {
    actualWeeklyKm: Math.round(actualWeeklyKm * 10) / 10,
    hasEnoughHistory: workload.ratio !== null,
    scenarios,
  };
}

router.get("/injury-risk/what-if", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json(GetInjuryRiskWhatIfResponse.parse(await computeWhatIfScenarios(req.user.id)));
});

router.get("/injury-risk/dashboard", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json(await computeInjuryRiskDashboard(req.user.id));
});

router.get("/injury-risk/intensity-map", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;

  const now = new Date();
  let year = now.getFullYear();
  let monthIdx = now.getMonth(); // 0-11
  const monthParam = typeof req.query.month === "string" ? req.query.month : undefined;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    monthIdx = m - 1;
  }

  const mm = String(monthIdx + 1).padStart(2, "0");
  const monthPrefix = `${year}-${mm}`;

  // Pull the athlete's ENTIRE activity history: we need it both to score this
  // month's days against their all-time hardest day and to render the month.
  const allActivities = await db
    .select()
    .from(activitiesTable)
    .where(eq(activitiesTable.userId, userId))
    .orderBy(desc(activitiesTable.activityDate));

  const monthActivities = allActivities.filter((a) => a.activityDate?.startsWith(monthPrefix));
  const allTimeMaxDailyLoad = maxDailyLoad(allActivities);

  const days = buildMonthlyIntensityMap(monthActivities, year, monthIdx, allTimeMaxDailyLoad);
  const label = new Date(year, monthIdx, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  res.json(GetInjuryRiskIntensityMapResponse.parse({ month: `${year}-${mm}`, label, days }));
});

router.post("/injury-risk/soreness", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CreateSorenessEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user.id;
  const today = new Date().toISOString().split("T")[0];

  const [entry] = await db
    .insert(sorenessLogsTable)
    .values({
      userId,
      bodyPart: parsed.data.bodyPart,
      painScore: parsed.data.painScore,
      loggedDate: today,
    })
    .returning();

  res.status(201).json({
    id: entry.id,
    bodyPart: entry.bodyPart,
    painScore: entry.painScore,
    loggedDate: entry.loggedDate,
    createdAt: entry.createdAt.toISOString(),
  });
});

/**
 * "Message your care team": send the athlete's coach an in-app notification
 * about an injury concern. The coach picks it up in their notification bell.
 * The optional `note` is the athlete's own message; if omitted we send a
 * sensible default. Requires the athlete to be on a team (that team's coach is
 * their care team).
 */
router.post("/injury-risk/notify-care-team", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const rawNote = typeof req.body?.note === "string" ? req.body.note.trim() : "";
  const note = rawNote.slice(0, 1000);

  const [membership] = await db
    .select({ teamId: teamMembershipsTable.teamId })
    .from(teamMembershipsTable)
    .where(eq(teamMembershipsTable.athleteUserId, userId))
    .limit(1);

  if (!membership) {
    res.status(400).json({ error: "You're not on a team yet — ask your coach for an invite code to connect your care team." });
    return;
  }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, membership.teamId)).limit(1);
  if (!team) {
    res.status(400).json({ error: "Your team could not be found." });
    return;
  }

  const athleteName = req.user.firstName ?? "An athlete";
  const message = note || "flagged an injury concern from their injury-risk dashboard and would like to check in.";

  await db.insert(notificationsTable).values({
    userId: team.coachUserId,
    type: "injury_concern",
    title: `${athleteName} flagged an injury concern`,
    message: note ? `${athleteName}: “${message}”` : `${athleteName} ${message}`,
  });

  res.status(201).json({ ok: true });
});

export default router;

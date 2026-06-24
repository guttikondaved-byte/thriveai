import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db, athleteProfileTable, activitiesTable, injuriesTable, injuryAlertsTable } from "@workspace/db";
import { createNotification } from "./notifications";

type RiskLevel = "low" | "medium" | "high" | "critical";

type RiskAlert = {
  riskLevel: RiskLevel;
  bodyPart: string;
  message: string;
  recommendation: string;
};

function normalizeRiskLevel(score: number): RiskLevel {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function getRecoveryPenalty(hrv: number | null, restingHeartRate: number | null): number {
  let penalty = 0;
  if (hrv !== null && hrv !== undefined) {
    if (hrv < 35) penalty += 20;
    else if (hrv < 50) penalty += 10;
  }
  if (restingHeartRate !== null && restingHeartRate !== undefined) {
    if (restingHeartRate > 85) penalty += 20;
    else if (restingHeartRate > 75) penalty += 10;
  }
  return penalty;
}

function getRiskAlertRecommendations(profile: typeof athleteProfileTable.$inferSelect, weeklyDistanceKm: number, previousWeeklyDistanceKm: number, activeInjuries: typeof injuriesTable.$inferSelect[]): RiskAlert[] {
  const alerts: RiskAlert[] = [];

  if (activeInjuries.length > 0) {
    for (const injury of activeInjuries) {
      alerts.push({
        riskLevel: "high",
        bodyPart: injury.bodyPart,
        message: `Active injury detected: ${injury.injuryType} on ${injury.bodyPart}`,
        recommendation: `Prioritize recovery for the injured area and reduce training volume until your symptoms improve.`,
      });
    }
  }

  if (previousWeeklyDistanceKm > 0 && weeklyDistanceKm > previousWeeklyDistanceKm * 1.25) {
    alerts.push({
      riskLevel: "medium",
      bodyPart: "Overall",
      message: "Sudden mileage increase detected",
      recommendation: "Your weekly distance jumped sharply. Back off for a few days to avoid overload.",
    });
  }

  if (profile.hrv !== null && profile.hrv !== undefined && profile.hrv < 40) {
    alerts.push({
      riskLevel: "high",
      bodyPart: "Recovery",
      message: "Low HRV indicates recovery stress",
      recommendation: "Take extra rest, improve sleep quality, and reduce intensity today.",
    });
  }

  if (profile.restingHeartRate !== null && profile.restingHeartRate !== undefined && profile.restingHeartRate > 80) {
    alerts.push({
      riskLevel: "high",
      bodyPart: "Recovery",
      message: "Elevated resting heart rate detected",
      recommendation: "Elevated RHR can signal fatigue or stress. Consider an easier day or active recovery.",
    });
  }

  return alerts;
}

async function upsertRiskAlert(userId: string, alert: RiskAlert): Promise<void> {
  const [existing] = await db
    .select()
    .from(injuryAlertsTable)
    .where(and(eq(injuryAlertsTable.userId, userId), eq(injuryAlertsTable.message, alert.message)))
    .limit(1);

  if (existing) {
    await db
      .update(injuryAlertsTable)
      .set({
        riskLevel: alert.riskLevel,
        bodyPart: alert.bodyPart,
        recommendation: alert.recommendation,
        acknowledged: false,
      })
      .where(eq(injuryAlertsTable.id, existing.id));
    return;
  }

  await db.insert(injuryAlertsTable).values({
    userId,
    riskLevel: alert.riskLevel,
    bodyPart: alert.bodyPart,
    message: alert.message,
    recommendation: alert.recommendation,
  });
}

async function getOrCreateProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(athleteProfileTable)
    .where(eq(athleteProfileTable.userId, userId))
    .limit(1);

  if (profile) return profile;

  const [created] = await db
    .insert(athleteProfileTable)
    .values({ userId, name: "Athlete", fitnessLevel: "intermediate", primaryGoal: "Stay fit" })
    .returning();

  return created;
}

export async function recalculateInjuryRisk(userId: string) {
  const profile = await getOrCreateProfile(userId);
  const profileId = profile.id;

  const today = new Date();
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const oneWeekAgoStr = oneWeekAgo.toISOString().slice(0, 10);
  const twoWeeksAgoStr = twoWeeksAgo.toISOString().slice(0, 10);

  const [recentActivities, previousActivities, activeInjuries] = await Promise.all([
    db.select().from(activitiesTable).where(and(eq(activitiesTable.userId, userId), gte(activitiesTable.activityDate, oneWeekAgoStr))),
    db.select().from(activitiesTable).where(and(eq(activitiesTable.userId, userId), gte(activitiesTable.activityDate, twoWeeksAgoStr), lt(activitiesTable.activityDate, oneWeekAgoStr))),
    db.select().from(injuriesTable).where(and(eq(injuriesTable.profileId, profileId), eq(injuriesTable.status, "active"))),
  ]);

  const runTypes = ["easy_run", "tempo_run", "interval", "long_run", "race"];
  const recentRuns = recentActivities.filter((act) => runTypes.includes(act.type));
  const previousRuns = previousActivities.filter((act) => runTypes.includes(act.type));

  const weeklyDistanceKm = recentRuns.reduce((sum, act) => sum + (act.distanceKm ? Number(act.distanceKm) : 0), 0);
  const previousWeeklyDistanceKm = previousRuns.reduce((sum, act) => sum + (act.distanceKm ? Number(act.distanceKm) : 0), 0);
  const weeklyRunCount = recentRuns.length;

  const mileageScore = Math.min(weeklyDistanceKm / 40, 1) * 35;
  const runCountScore = Math.min(weeklyRunCount / 6, 1) * 15;
  const injuryPenalty = Math.min(activeInjuries.length * 15, 30);
  const recoveryPenalty = getRecoveryPenalty(profile.hrv ?? null, profile.restingHeartRate ?? null);
  const spikePenalty = previousWeeklyDistanceKm > 0 && weeklyDistanceKm > previousWeeklyDistanceKm * 1.25 ? 15 : 0;

  let score = mileageScore + runCountScore + injuryPenalty + recoveryPenalty + spikePenalty;
  score = Math.min(Math.round(score), 100);

  const level = normalizeRiskLevel(score);

  const [updated] = await db
    .update(athleteProfileTable)
    .set({
      injuryRiskScore: String(score),
      injuryRiskLevel: level,
      injuryRiskUpdatedAt: new Date(),
    })
    .where(eq(athleteProfileTable.id, profileId))
    .returning();

  const oldLevel = profile.injuryRiskLevel ?? "low";
  const oldScore = profile.injuryRiskScore ? Number(profile.injuryRiskScore) : 0;
  const scoreDelta = Math.abs(score - oldScore);

  if (level !== oldLevel || scoreDelta >= 15) {
    const title = level !== oldLevel
      ? `Injury risk moved to ${level}`
      : `Injury risk changed by ${scoreDelta} points`;
    const message = level !== oldLevel
      ? `Your injury risk level changed from ${oldLevel} to ${level}. Check the risk dashboard for details.`
      : `Your injury risk score moved from ${oldScore} to ${score}. Keep an eye on recovery and training load.`;

    await createNotification(userId, title, message, "risk");
  }

  const alerts = getRiskAlertRecommendations(profile, weeklyDistanceKm, previousWeeklyDistanceKm, activeInjuries);
  await Promise.all(alerts.map((alert) => upsertRiskAlert(userId, alert)));

  return { score, level, updatedAt: updated.injuryRiskUpdatedAt };
}

import { Router, type Request, type IRouter } from "express";
import { gte, and, eq } from "drizzle-orm";
import { db, activitiesTable, injuryAlertsTable, trainingPlansTable, athleteProfileTable } from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req: Request, res): Promise<void> => {
  const userId = req.user!.id;
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneWeekAgoStr = oneWeekAgo.toISOString().split("T")[0];

  const [allActivities, allAlerts, allPlans, profileRows] = await Promise.all([
    db.select().from(activitiesTable).where(and(eq(activitiesTable.userId, userId), gte(activitiesTable.activityDate, oneWeekAgoStr))),
    db.select().from(injuryAlertsTable).where(and(eq(injuryAlertsTable.userId, userId), eq(injuryAlertsTable.acknowledged, false))),
    db.select().from(trainingPlansTable).where(and(eq(trainingPlansTable.userId, userId), eq(trainingPlansTable.status, "active"))).limit(1),
    db.select().from(athleteProfileTable).where(eq(athleteProfileTable.userId, userId)).limit(1),
  ]);

  const profile = profileRows[0] ?? null;

  const recentActivities = await db
    .select()
    .from(activitiesTable)
    .where(eq(activitiesTable.userId, userId))
    .orderBy(activitiesTable.activityDate)
    .limit(5);

  const runs = allActivities.filter(a => ["easy_run", "tempo_run", "interval", "long_run", "race"].includes(a.type));
  const weeklyDistanceKm = runs.reduce((sum, a) => sum + (a.distanceKm ? Number(a.distanceKm) : 0), 0);
  const weeklyRuns = runs.length;

  const runsWithPace = runs.filter(a => a.distanceKm && Number(a.distanceKm) > 0 && a.durationMinutes);
  const avgPaceMinPerKm = runsWithPace.length > 0
    ? runsWithPace.reduce((sum, a) => sum + (a.durationMinutes! / Number(a.distanceKm!)), 0) / runsWithPace.length
    : null;

  const currentPlan = allPlans[0] ?? null;

  let trainingLoad: "low" | "moderate" | "high" | "very_high" = "low";
  if (weeklyDistanceKm > 37) trainingLoad = "very_high";
  else if (weeklyDistanceKm > 25) trainingLoad = "high";
  else if (weeklyDistanceKm > 12) trainingLoad = "moderate";

  res.json(GetDashboardSummaryResponse.parse({
    weeklyDistanceKm: Math.round(weeklyDistanceKm * 10) / 10,
    weeklyRuns,
    avgPaceMinPerKm: avgPaceMinPerKm ? Math.round(avgPaceMinPerKm * 10) / 10 : null,
    activeAlerts: allAlerts.length,
    currentPlanName: currentPlan?.name ?? null,
    currentPlanProgress: null,
    recentActivities: recentActivities.map(a => ({
      ...a,
      distanceKm: a.distanceKm ? Number(a.distanceKm) : null,
      createdAt: a.createdAt.toISOString(),
    })),
    hrvTrend: null,
    trainingLoad,
    injuryRiskScore: profile?.injuryRiskScore ? Number(profile.injuryRiskScore) : null,
    injuryRiskLevel: profile?.injuryRiskLevel ?? null,
  }));
});

export default router;

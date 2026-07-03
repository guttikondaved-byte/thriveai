import { Router, type Request, type IRouter } from "express";
import { eq, inArray, desc } from "drizzle-orm";
import {
  db,
  trainingPlansTable,
  planSessionsTable,
  planEditSuggestionsTable,
  athleteProfileTable,
  teamMembershipsTable,
  teamsTable,
  teamCoachesTable,
  notificationsTable,
} from "@workspace/db";

const router: IRouter = Router();

async function getCoachMemberIds(req: Request): Promise<string[] | "unauthorized" | "forbidden"> {
  if (!req.isAuthenticated()) return "unauthorized";
  const [profile] = await db
    .select({ userRole: athleteProfileTable.userRole })
    .from(athleteProfileTable)
    .where(eq(athleteProfileTable.userId, req.user.id))
    .limit(1);
  if (profile?.userRole !== "coach") return "forbidden";

  const [ownTeam] = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.coachUserId, req.user.id))
    .orderBy(desc(teamsTable.createdAt))
    .limit(1);

  let team = ownTeam;
  if (!team) {
    const [coCoach] = await db
      .select({ teamId: teamCoachesTable.teamId })
      .from(teamCoachesTable)
      .where(eq(teamCoachesTable.coachUserId, req.user.id))
      .limit(1);
    if (coCoach) {
      [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, coCoach.teamId)).limit(1);
    }
  }
  if (!team) return [];

  const memberships = await db
    .select({ athleteUserId: teamMembershipsTable.athleteUserId })
    .from(teamMembershipsTable)
    .where(eq(teamMembershipsTable.teamId, team.id));
  return memberships.map(m => m.athleteUserId);
}

router.get("/coach/team-athletes", async (req: Request, res): Promise<void> => {
  const memberIds = await getCoachMemberIds(req);
  if (memberIds === "unauthorized") { res.status(401).json({ error: "Unauthorized" }); return; }
  if (memberIds === "forbidden") { res.status(403).json({ error: "Forbidden" }); return; }
  if (memberIds.length === 0) { res.json([]); return; }
  const profiles = await db
    .select({ userId: athleteProfileTable.userId, name: athleteProfileTable.name, fitnessLevel: athleteProfileTable.fitnessLevel, primaryGoal: athleteProfileTable.primaryGoal })
    .from(athleteProfileTable)
    .where(inArray(athleteProfileTable.userId, memberIds));
  res.json(profiles);
});

router.get("/coach/team-plans", async (req: Request, res): Promise<void> => {
  const memberIds = await getCoachMemberIds(req);
  if (memberIds === "unauthorized") { res.status(401).json({ error: "Unauthorized" }); return; }
  if (memberIds === "forbidden") { res.status(403).json({ error: "Forbidden" }); return; }
  if (memberIds.length === 0) { res.json([]); return; }
  const [plans, profiles] = await Promise.all([
    db.select().from(trainingPlansTable).where(inArray(trainingPlansTable.userId, memberIds)).orderBy(trainingPlansTable.createdAt),
    db.select({ userId: athleteProfileTable.userId, name: athleteProfileTable.name })
      .from(athleteProfileTable)
      .where(inArray(athleteProfileTable.userId, memberIds)),
  ]);
  const nameByUser = new Map(profiles.map(p => [p.userId, p.name]));
  res.json(plans.map(p => ({
    ...p,
    weeklyMileage: p.weeklyMileage ? Number(p.weeklyMileage) : null,
    createdAt: p.createdAt.toISOString(),
    athleteName: (p.userId && nameByUser.get(p.userId)) || "Athlete",
  })));
});

router.post("/coach/team-plans", async (req: Request, res): Promise<void> => {
  const memberIds = await getCoachMemberIds(req);
  if (memberIds === "unauthorized") { res.status(401).json({ error: "Unauthorized" }); return; }
  if (memberIds === "forbidden") { res.status(403).json({ error: "Forbidden" }); return; }

  const { athleteUserId, name, goal, startDate, endDate, weeklyMileage } = req.body as {
    athleteUserId?: string; name?: string; goal?: string; startDate?: string; endDate?: string; weeklyMileage?: number;
  };

  if (!athleteUserId || !name || !goal || !startDate || !endDate) {
    res.status(400).json({ error: "Missing required fields" }); return;
  }
  if (!memberIds.includes(athleteUserId)) {
    res.status(403).json({ error: "Athlete not on your team" }); return;
  }

  // Coach-authored — the athlete can only suggest changes to this plan, not edit it directly.
  const insert: typeof trainingPlansTable.$inferInsert = { userId: athleteUserId, createdBy: req.user!.id, name, goal, startDate, endDate, status: "active" };
  if (weeklyMileage !== undefined) insert.weeklyMileage = String(weeklyMileage);

  const [plan] = await db.insert(trainingPlansTable).values(insert).returning();

  const start = new Date(plan.startDate);
  const end = new Date(plan.endDate);
  const weeks = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000)));
  const templates = [
    { dayOfWeek: 1, sessionType: "easy_run", description: "Easy recovery run", distanceKm: "3.10" },
    { dayOfWeek: 3, sessionType: "tempo_run", description: "Tempo run at comfortably hard pace", distanceKm: "5.00" },
    { dayOfWeek: 6, sessionType: "long_run", description: "Long slow distance run", distanceKm: "8.70" },
  ];
  const sessions: (typeof planSessionsTable.$inferInsert)[] = [];
  for (let w = 1; w <= Math.min(weeks, 12); w++) {
    for (const t of templates) sessions.push({ planId: plan.id, weekNumber: w, ...t });
  }
  if (sessions.length > 0) await db.insert(planSessionsTable).values(sessions);

  res.status(201).json({ ...plan, weeklyMileage: plan.weeklyMileage ? Number(plan.weeklyMileage) : null, createdAt: plan.createdAt.toISOString() });
});

router.delete("/coach/team-plans/:id", async (req: Request, res): Promise<void> => {
  const memberIds = await getCoachMemberIds(req);
  if (memberIds === "unauthorized") { res.status(401).json({ error: "Unauthorized" }); return; }
  if (memberIds === "forbidden") { res.status(403).json({ error: "Forbidden" }); return; }

  const planId = parseInt(req.params.id as string, 10);
  if (isNaN(planId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [plan] = await db.select().from(trainingPlansTable).where(eq(trainingPlansTable.id, planId)).limit(1);
  if (!plan?.userId || !memberIds.includes(plan.userId)) { res.status(404).json({ error: "Not found" }); return; }

  await db.delete(trainingPlansTable).where(eq(trainingPlansTable.id, planId));
  res.sendStatus(204);
});

// ── Approve or reject an athlete's suggested plan ────────────────────────────

router.post("/coach/team-plans/:id/approve", async (req: Request, res): Promise<void> => {
  const memberIds = await getCoachMemberIds(req);
  if (memberIds === "unauthorized") { res.status(401).json({ error: "Unauthorized" }); return; }
  if (memberIds === "forbidden") { res.status(403).json({ error: "Forbidden" }); return; }

  const planId = parseInt(req.params.id as string, 10);
  if (isNaN(planId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [plan] = await db.select().from(trainingPlansTable).where(eq(trainingPlansTable.id, planId)).limit(1);
  if (!plan?.userId || !memberIds.includes(plan.userId) || plan.status !== "pending") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [updated] = await db
    .update(trainingPlansTable)
    .set({ status: "active" })
    .where(eq(trainingPlansTable.id, planId))
    .returning();

  await db.insert(notificationsTable).values({
    userId: plan.userId,
    type: "training_plan",
    title: "Plan approved",
    message: `Your coach approved your suggested plan: "${plan.name}".`,
  });

  res.json({ ...updated, weeklyMileage: updated.weeklyMileage ? Number(updated.weeklyMileage) : null, createdAt: updated.createdAt.toISOString() });
});

router.post("/coach/team-plans/:id/reject", async (req: Request, res): Promise<void> => {
  const memberIds = await getCoachMemberIds(req);
  if (memberIds === "unauthorized") { res.status(401).json({ error: "Unauthorized" }); return; }
  if (memberIds === "forbidden") { res.status(403).json({ error: "Forbidden" }); return; }

  const planId = parseInt(req.params.id as string, 10);
  if (isNaN(planId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [plan] = await db.select().from(trainingPlansTable).where(eq(trainingPlansTable.id, planId)).limit(1);
  if (!plan?.userId || !memberIds.includes(plan.userId) || plan.status !== "pending") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [updated] = await db
    .update(trainingPlansTable)
    .set({ status: "rejected" })
    .where(eq(trainingPlansTable.id, planId))
    .returning();

  await db.insert(notificationsTable).values({
    userId: plan.userId,
    type: "plan_suggestion",
    title: "Plan not approved",
    message: `Your coach didn't approve your suggested plan: "${plan.name}". Try suggesting a revised one.`,
  });

  res.json({ ...updated, weeklyMileage: updated.weeklyMileage ? Number(updated.weeklyMileage) : null, createdAt: updated.createdAt.toISOString() });
});

// ── Suggested changes to coach-authored plans ────────────────────────────────

router.get("/coach/plan-suggestions", async (req: Request, res): Promise<void> => {
  const memberIds = await getCoachMemberIds(req);
  if (memberIds === "unauthorized") { res.status(401).json({ error: "Unauthorized" }); return; }
  if (memberIds === "forbidden") { res.status(403).json({ error: "Forbidden" }); return; }
  if (memberIds.length === 0) { res.json([]); return; }

  const plans = await db.select({ id: trainingPlansTable.id, name: trainingPlansTable.name, userId: trainingPlansTable.userId })
    .from(trainingPlansTable)
    .where(inArray(trainingPlansTable.userId, memberIds));
  const planIds = plans.map(p => p.id);
  if (planIds.length === 0) { res.json([]); return; }

  const [suggestions, profiles] = await Promise.all([
    db.select().from(planEditSuggestionsTable).where(inArray(planEditSuggestionsTable.planId, planIds)).orderBy(desc(planEditSuggestionsTable.createdAt)),
    db.select({ userId: athleteProfileTable.userId, name: athleteProfileTable.name }).from(athleteProfileTable).where(inArray(athleteProfileTable.userId, memberIds)),
  ]);
  const planById = new Map(plans.map(p => [p.id, p]));
  const nameByUser = new Map(profiles.map(p => [p.userId, p.name]));

  res.json(suggestions.map(s => {
    const plan = planById.get(s.planId);
    return {
      ...s,
      createdAt: s.createdAt.toISOString(),
      planName: plan?.name ?? "Plan",
      athleteName: (plan?.userId && nameByUser.get(plan.userId)) || "Athlete",
    };
  }));
});

router.post("/coach/plan-suggestions/:id/approve", async (req: Request, res): Promise<void> => {
  const memberIds = await getCoachMemberIds(req);
  if (memberIds === "unauthorized") { res.status(401).json({ error: "Unauthorized" }); return; }
  if (memberIds === "forbidden") { res.status(403).json({ error: "Forbidden" }); return; }

  const suggestionId = parseInt(req.params.id as string, 10);
  if (isNaN(suggestionId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [suggestion] = await db.select().from(planEditSuggestionsTable).where(eq(planEditSuggestionsTable.id, suggestionId)).limit(1);
  if (!suggestion || suggestion.status !== "pending") { res.status(404).json({ error: "Not found" }); return; }

  const [plan] = await db.select().from(trainingPlansTable).where(eq(trainingPlansTable.id, suggestion.planId)).limit(1);
  if (!plan?.userId || !memberIds.includes(plan.userId)) { res.status(404).json({ error: "Not found" }); return; }

  for (const s of suggestion.sessions) {
    if (s.sessionId) {
      await db.update(planSessionsTable)
        .set({
          sessionType: s.sessionType,
          description: s.description,
          distanceKm: s.distanceKm != null ? String(s.distanceKm) : null,
          durationMinutes: s.durationMinutes,
        })
        .where(eq(planSessionsTable.id, s.sessionId));
    } else {
      await db.insert(planSessionsTable).values({
        planId: suggestion.planId,
        weekNumber: s.weekNumber,
        dayOfWeek: s.dayOfWeek,
        sessionType: s.sessionType,
        description: s.description,
        distanceKm: s.distanceKm != null ? String(s.distanceKm) : null,
        durationMinutes: s.durationMinutes,
      });
    }
  }

  await db.update(planEditSuggestionsTable).set({ status: "approved" }).where(eq(planEditSuggestionsTable.id, suggestionId));

  await db.insert(notificationsTable).values({
    userId: suggestion.submittedBy,
    type: "training_plan",
    title: "Suggested changes approved",
    message: `Your coach approved your suggested changes to "${plan.name}".`,
  });

  res.json({ ok: true });
});

router.post("/coach/plan-suggestions/:id/reject", async (req: Request, res): Promise<void> => {
  const memberIds = await getCoachMemberIds(req);
  if (memberIds === "unauthorized") { res.status(401).json({ error: "Unauthorized" }); return; }
  if (memberIds === "forbidden") { res.status(403).json({ error: "Forbidden" }); return; }

  const suggestionId = parseInt(req.params.id as string, 10);
  if (isNaN(suggestionId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [suggestion] = await db.select().from(planEditSuggestionsTable).where(eq(planEditSuggestionsTable.id, suggestionId)).limit(1);
  if (!suggestion || suggestion.status !== "pending") { res.status(404).json({ error: "Not found" }); return; }

  const [plan] = await db.select().from(trainingPlansTable).where(eq(trainingPlansTable.id, suggestion.planId)).limit(1);
  if (!plan?.userId || !memberIds.includes(plan.userId)) { res.status(404).json({ error: "Not found" }); return; }

  await db.update(planEditSuggestionsTable).set({ status: "rejected" }).where(eq(planEditSuggestionsTable.id, suggestionId));

  await db.insert(notificationsTable).values({
    userId: suggestion.submittedBy,
    type: "plan_suggestion",
    title: "Suggested changes not approved",
    message: `Your coach didn't approve your suggested changes to "${plan.name}".`,
  });

  res.json({ ok: true });
});

export default router;

import { Router, type Request, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  trainingPlansTable,
  planSessionsTable,
  athleteProfileTable,
  teamMembershipsTable,
  teamsTable,
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
  const [team] = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.coachUserId, req.user.id))
    .limit(1);
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

  const insert: typeof trainingPlansTable.$inferInsert = { userId: athleteUserId, name, goal, startDate, endDate, status: "active" };
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

export default router;

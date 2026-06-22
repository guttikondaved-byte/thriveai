import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, trainingPlansTable, planSessionsTable } from "@workspace/db";
import {
  ListTrainingPlansResponse,
  CreateTrainingPlanBody,
  GetTrainingPlanParams,
  GetTrainingPlanResponse,
  DeleteTrainingPlanParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializePlan(p: typeof trainingPlansTable.$inferSelect) {
  return {
    ...p,
    weeklyMileage: p.weeklyMileage ? Number(p.weeklyMileage) : null,
    createdAt: p.createdAt.toISOString(),
  };
}

function serializeSession(s: typeof planSessionsTable.$inferSelect) {
  return {
    ...s,
    distanceKm: s.distanceKm ? Number(s.distanceKm) : null,
  };
}

router.get("/plans", async (_req, res): Promise<void> => {
  const plans = await db.select().from(trainingPlansTable).orderBy(trainingPlansTable.createdAt);
  res.json(ListTrainingPlansResponse.parse(plans.map(serializePlan)));
});

router.post("/plans", async (req, res): Promise<void> => {
  const parsed = CreateTrainingPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const insertData: Record<string, unknown> = {
    name: parsed.data.name,
    goal: parsed.data.goal,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    status: "active",
  };
  if (parsed.data.weeklyMileage !== undefined) insertData.weeklyMileage = String(parsed.data.weeklyMileage);

  const [plan] = await db.insert(trainingPlansTable).values(insertData as Parameters<typeof db.insert>[0] extends { values: (v: infer V) => unknown } ? V : never).returning();

  // Auto-generate basic sessions
  const start = new Date(plan.startDate);
  const end = new Date(plan.endDate);
  const weeks = Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000));
  const sessionTemplates = [
    { dayOfWeek: 1, sessionType: "easy_run", description: "Easy recovery run", distanceKm: "3.10" },
    { dayOfWeek: 3, sessionType: "tempo_run", description: "Tempo run at comfortably hard pace", distanceKm: "5.00" },
    { dayOfWeek: 6, sessionType: "long_run", description: "Long slow distance run", distanceKm: "8.70" },
  ];

  const sessions = [];
  for (let w = 1; w <= Math.min(weeks, 12); w++) {
    for (const t of sessionTemplates) {
      sessions.push({ planId: plan.id, weekNumber: w, ...t });
    }
  }
  if (sessions.length > 0) {
    await db.insert(planSessionsTable).values(sessions);
  }

  res.status(201).json(serializePlan(plan));
});

router.get("/plans/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetTrainingPlanParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [plan] = await db.select().from(trainingPlansTable).where(eq(trainingPlansTable.id, params.data.id));
  if (!plan) {
    res.status(404).json({ error: "Training plan not found" });
    return;
  }
  const sessions = await db.select().from(planSessionsTable).where(eq(planSessionsTable.planId, plan.id)).orderBy(planSessionsTable.weekNumber, planSessionsTable.dayOfWeek);
  res.json(GetTrainingPlanResponse.parse({ ...serializePlan(plan), sessions: sessions.map(serializeSession) }));
});

router.delete("/plans/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteTrainingPlanParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [plan] = await db.delete(trainingPlansTable).where(eq(trainingPlansTable.id, params.data.id)).returning();
  if (!plan) {
    res.status(404).json({ error: "Training plan not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;

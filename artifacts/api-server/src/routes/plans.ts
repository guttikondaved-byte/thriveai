import { Router, type Request, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  trainingPlansTable,
  planSessionsTable,
  athleteProfileTable,
  activitiesTable,
} from "@workspace/db";
import {
  ListTrainingPlansResponse,
  CreateTrainingPlanBody,
  GetTrainingPlanParams,
  GetTrainingPlanResponse,
  DeleteTrainingPlanParams,
} from "@workspace/api-zod";
import { z } from "zod";
import OpenAI from "openai";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const glmClient = process.env.GLM_API_KEY
  ? new OpenAI({
      apiKey: process.env.GLM_API_KEY,
      baseURL: "https://open.bigmodel.cn/api/paas/v4/",
      timeout: 30_000, // 30s — background job, won't block the response
    })
  : null;

const VALID_SESSION_TYPES = ["easy_run", "tempo_run", "interval", "long_run", "cross_training", "rest", "race"];

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

const UpdateTrainingPlanBody = z.object({
  name: z.string().optional(),
  goal: z.string().optional(),
  startDate: z.preprocess((arg) => {
    if (typeof arg === "string") return new Date(arg);
    return arg;
  }, z.date()).optional(),
  endDate: z.preprocess((arg) => {
    if (typeof arg === "string") return new Date(arg);
    return arg;
  }, z.date()).optional(),
  weeklyMileage: z.number().nullable().optional(),
  status: z.enum(["active", "completed", "paused"]).optional(),
});

const UpdatePlanSessionBody = z.object({
  completed: z.boolean().optional(),
  description: z.string().optional(),
  distanceKm: z.number().nullable().optional(),
  durationMinutes: z.number().nullable().optional(),
});

type SessionInsert = typeof planSessionsTable.$inferInsert;

// Keyword-based sport detection used by the fallback path
function detectSport(name: string, goal: string): "soccer" | "basketball" | "running" | "general" {
  const text = (name + " " + goal).toLowerCase();
  if (/soccer|football|striker|midfielder|defender|goalkeeper|dribbling/.test(text)) return "soccer";
  if (/basketball|vertical.?jump|dunk|layup|three.?point|court/.test(text)) return "basketball";
  if (/marathon|5k|10k|half.marathon|ultra|running|runner|distance|sprint|pace/.test(text)) return "running";
  return "general";
}

// Sport-aware fallback when AI is unavailable or fails
function buildFallbackSessions(
  planId: number,
  name: string,
  goal: string,
  weeklyMiles: number,
  totalWeeks: number,
): SessionInsert[] {
  const sport = detectSport(name, goal);
  const miles = Math.max(weeklyMiles, 10);

  let template: Array<{
    dayOfWeek: number;
    sessionType: string;
    description: string;
    distanceKm: string | null;
    durationMinutes: number;
  }>;

  if (sport === "soccer") {
    template = [
      { dayOfWeek: 1, sessionType: "cross_training", description: "Agility ladder drills + 4-cone box drill (15 min) + dynamic warm-up", distanceKm: null, durationMinutes: 45 },
      { dayOfWeek: 3, sessionType: "interval", description: "Sprint intervals: 6×40m acceleration runs + 4×200m at 90% effort with 90s rest between sets", distanceKm: "1.5", durationMinutes: 40 },
      { dayOfWeek: 5, sessionType: "cross_training", description: "Small-sided game simulation + ball control circuits + finishing drills (30 min technical)", distanceKm: null, durationMinutes: 60 },
      { dayOfWeek: 7, sessionType: "easy_run", description: "Easy aerobic conditioning run at comfortable conversational pace", distanceKm: String((miles * 0.3).toFixed(2)), durationMinutes: 30 },
    ];
  } else if (sport === "basketball") {
    template = [
      { dayOfWeek: 1, sessionType: "cross_training", description: "Plyometric circuit: box jumps 3×10, depth jumps 3×8, banded squat jumps 3×12 — full recovery between sets", distanceKm: null, durationMinutes: 50 },
      { dayOfWeek: 3, sessionType: "interval", description: "Court conditioning: 8 full-court sprints with 60s rest + defensive slide intervals (4 lengths × 4 sets)", distanceKm: null, durationMinutes: 40 },
      { dayOfWeek: 5, sessionType: "cross_training", description: "Lower body strength: back squats 4×6, Romanian deadlifts 3×8, walking lunges 3×12 + core circuit", distanceKm: null, durationMinutes: 55 },
      { dayOfWeek: 7, sessionType: "easy_run", description: "Recovery aerobic run to maintain cardiovascular base — keep effort easy (zone 2)", distanceKm: "3.0", durationMinutes: 30 },
    ];
  } else {
    // running or general
    const long = +(miles * 0.35).toFixed(2);
    const tempo = +(miles * 0.2).toFixed(2);
    const easy = +(miles * 0.25).toFixed(2);
    template = [
      { dayOfWeek: 1, sessionType: "easy_run", description: "Easy recovery run — conversational pace, heart rate in zone 2", distanceKm: String(easy), durationMinutes: Math.round(easy * 10) },
      { dayOfWeek: 3, sessionType: "tempo_run", description: "Tempo run at comfortably hard effort (RPE 7/10) — build lactate threshold", distanceKm: String(tempo), durationMinutes: Math.round(tempo * 8) },
      { dayOfWeek: 5, sessionType: "interval", description: "Track intervals: 5×800m at goal race pace with 90s recovery jog between reps", distanceKm: "3.0", durationMinutes: 35 },
      { dayOfWeek: 6, sessionType: "long_run", description: "Long slow distance run — easy conversational pace, building time on feet", distanceKm: String(long), durationMinutes: Math.round(long * 11) },
    ];
  }

  const sessions: SessionInsert[] = [];
  for (let w = 1; w <= Math.min(totalWeeks, 12); w++) {
    const progressFactor = 1 + Math.min(0.4, (w - 1) * 0.05); // +5% every week, capped at +40%
    for (const t of template) {
      sessions.push({
        planId,
        weekNumber: w,
        dayOfWeek: t.dayOfWeek,
        sessionType: t.sessionType,
        description: t.description,
        distanceKm: t.distanceKm ? String(+(Number(t.distanceKm) * progressFactor).toFixed(2)) : null,
        durationMinutes: t.durationMinutes > 0 ? Math.round(t.durationMinutes * progressFactor) : null,
        completed: false,
      });
    }
  }
  return sessions;
}

// Calls the GLM API to generate a sport-specific 2-week template, then expands it
async function generateAiPlanSessions(
  planId: number,
  name: string,
  goal: string,
  weeklyMiles: number,
  totalWeeks: number,
  fitnessLevel: string,
  activitySummary: string,
  client: OpenAI,
): Promise<SessionInsert[]> {
  const systemPrompt = `You are an expert sports coach generating a personalized training plan. All distances in MILES.

Respond ONLY with valid JSON (no markdown fences, no prose):
{
  "sessions": [
    { "weekNumber": 1, "dayOfWeek": 1, "sessionType": "easy_run", "description": "specific actionable description", "distanceMiles": 4.5, "durationMinutes": 45 }
  ]
}

Requirements:
- Provide exactly 14 sessions covering dayOfWeek 1 (Mon) through 7 (Sun) for both weeks 1 and 2
- Valid sessionTypes: easy_run, tempo_run, interval, long_run, cross_training, rest, race
- Use "rest" on recovery days (distanceMiles: 0, durationMinutes: 0)
- Read the plan name and goal carefully to identify the sport and focus
- Team sports (soccer, basketball, etc.): use cross_training for drills/strength, interval for sprints/conditioning, easy_run only for aerobic base — no tempo or long_run
- Running goals: use the full session type variety matched to the target race distance
- Descriptions must be specific (e.g. "6×400m at 5K pace with 90s recovery jog", not "interval training")
- Week 2 should show slight progression over week 1 in volume or intensity
- Scale distances and durations to match the stated weekly mileage target`;

  const userMsg = `Plan: "${name}"
Goal: ${goal}
Weekly target: ${weeklyMiles} miles
Duration: ${totalWeeks} weeks
Athlete level: ${fitnessLevel}${activitySummary ? `\nRecent activity: ${activitySummary}` : ""}

Design the 2-week training block now.`;

  const completion = await client.chat.completions.create({
    model: "glm-4-flash",
    max_tokens: 2200,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMsg },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const jsonStr = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(jsonStr) as { sessions: Array<Record<string, unknown>> };
  const rawSessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];

  if (rawSessions.length === 0) throw new Error("AI returned empty sessions");

  const template = rawSessions.map((s) => {
    const type = String(s.sessionType ?? "cross_training");
    const miles = Math.max(0, Number(s.distanceMiles) || 0);
    return {
      weekNumber: Math.min(2, Math.max(1, Number(s.weekNumber) || 1)),
      dayOfWeek: Math.min(7, Math.max(1, Number(s.dayOfWeek) || 1)),
      sessionType: VALID_SESSION_TYPES.includes(type) ? type : "cross_training",
      description: String(s.description ?? "").slice(0, 280) || "Training session",
      distanceMiles: miles,
      durationMinutes: Math.max(0, Math.round(Number(s.durationMinutes) || 0)),
    };
  });

  // Expand the 2-week template to the full plan with progressive overload
  const sessions: SessionInsert[] = [];
  for (let w = 1; w <= Math.min(totalWeeks, 12); w++) {
    const sourceWeek = ((w - 1) % 2) + 1; // 1,2,1,2,...
    const progressFactor = 1 + Math.min(0.4, (w - 1) * 0.05); // +5% every week, capped at +40%
    const weekTemplate = template.filter((s) => s.weekNumber === sourceWeek);
    for (const s of weekTemplate) {
      sessions.push({
        planId,
        weekNumber: w,
        dayOfWeek: s.dayOfWeek,
        sessionType: s.sessionType,
        description: s.description,
        distanceKm: s.distanceMiles > 0 ? String(+(s.distanceMiles * progressFactor).toFixed(2)) : null,
        durationMinutes: s.durationMinutes > 0 ? Math.round(s.durationMinutes * progressFactor) : null,
        completed: false,
      });
    }
  }
  return sessions;
}

router.get("/plans", async (req: Request, res): Promise<void> => {
  const userId = req.user!.id;
  const plans = await db
    .select()
    .from(trainingPlansTable)
    .where(eq(trainingPlansTable.userId, userId))
    .orderBy(trainingPlansTable.createdAt);
  res.json(ListTrainingPlansResponse.parse(plans.map(serializePlan)));
});

router.post("/plans", async (req: Request, res): Promise<void> => {
  const parsed = CreateTrainingPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user!.id;
  const toDateStr = (d: Date) => d.toISOString().split("T")[0]!;
  const insertValues: typeof trainingPlansTable.$inferInsert = {
    userId,
    name: parsed.data.name,
    goal: parsed.data.goal,
    startDate: toDateStr(parsed.data.startDate),
    endDate: toDateStr(parsed.data.endDate),
    status: "active",
  };
  if (parsed.data.weeklyMileage !== undefined) {
    insertValues.weeklyMileage = String(parsed.data.weeklyMileage);
  }
  const [plan] = await db.insert(trainingPlansTable).values(insertValues).returning();

  const start = new Date(plan.startDate);
  const end = new Date(plan.endDate);
  const weeks = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000)));
  const weeklyMiles = parsed.data.weeklyMileage ?? 20;

  // Insert sport-aware sessions immediately so the plan is never empty and the
  // response is fast. AI-generated sessions replace these in the background.
  const fallbackSessions = buildFallbackSessions(plan.id, plan.name, plan.goal, weeklyMiles, weeks);
  await db.insert(planSessionsTable).values(fallbackSessions);

  // Respond to the client right away — no waiting for the AI.
  res.status(201).json(serializePlan(plan));

  // Background: fetch context then upgrade sessions with AI if available.
  if (!glmClient) return;

  Promise.all([
    db.select({ fitnessLevel: athleteProfileTable.fitnessLevel })
      .from(athleteProfileTable)
      .where(eq(athleteProfileTable.userId, userId))
      .limit(1),
    db.select({ type: activitiesTable.type, distanceKm: activitiesTable.distanceKm })
      .from(activitiesTable)
      .where(eq(activitiesTable.userId, userId))
      .orderBy(desc(activitiesTable.activityDate))
      .limit(5),
  ])
    .then(async ([profileRows, recentActivities]) => {
      const fitnessLevel = profileRows[0]?.fitnessLevel ?? "intermediate";
      const activitySummary = recentActivities
        .map((a) => `${a.type.replace(/_/g, " ")}${a.distanceKm ? " " + Number(a.distanceKm).toFixed(1) + "mi" : ""}`)
        .join(", ");

      const aiSessions = await generateAiPlanSessions(
        plan.id,
        plan.name,
        plan.goal,
        weeklyMiles,
        weeks,
        fitnessLevel,
        activitySummary,
        glmClient,
      );

      if (aiSessions.length > 0) {
        await db.delete(planSessionsTable).where(eq(planSessionsTable.planId, plan.id));
        await db.insert(planSessionsTable).values(aiSessions);
        logger.info({ planId: plan.id, sessions: aiSessions.length }, "AI sessions applied");
      }
    })
    .catch((err) => logger.error({ err, planId: plan.id }, "Background AI plan generation failed"));
});

router.patch("/plans/:id", async (req: Request, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetTrainingPlanParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTrainingPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user!.id;
  const [plan] = await db
    .select()
    .from(trainingPlansTable)
    .where(and(eq(trainingPlansTable.id, params.data.id), eq(trainingPlansTable.userId, userId)));
  if (!plan) {
    res.status(404).json({ error: "Training plan not found" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.goal !== undefined) updateData.goal = parsed.data.goal;
  if (parsed.data.startDate !== undefined) updateData.startDate = parsed.data.startDate.toISOString().split("T")[0];
  if (parsed.data.endDate !== undefined) updateData.endDate = parsed.data.endDate.toISOString().split("T")[0];
  if (parsed.data.weeklyMileage !== undefined) updateData.weeklyMileage = parsed.data.weeklyMileage === null ? null : String(parsed.data.weeklyMileage);
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;

  if (Object.keys(updateData).length === 0) {
    res.json(GetTrainingPlanResponse.parse({ ...serializePlan(plan), sessions: [] }));
    return;
  }

  const [updated] = await db
    .update(trainingPlansTable)
    .set(updateData)
    .where(eq(trainingPlansTable.id, params.data.id))
    .returning();

  res.json(GetTrainingPlanResponse.parse({ ...serializePlan(updated), sessions: [] }));
});

router.patch("/plans/:planId/sessions/:sessionId", async (req: Request, res): Promise<void> => {
  const planIdRaw = Array.isArray(req.params.planId) ? req.params.planId[0] : req.params.planId;
  const sessionIdRaw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const planId = parseInt(planIdRaw, 10);
  const sessionId = parseInt(sessionIdRaw, 10);
  if (Number.isNaN(planId) || Number.isNaN(sessionId)) {
    res.status(400).json({ error: "Invalid plan or session id" });
    return;
  }

  const parsed = UpdatePlanSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user!.id;
  const [plan] = await db
    .select()
    .from(trainingPlansTable)
    .where(and(eq(trainingPlansTable.id, planId), eq(trainingPlansTable.userId, userId)));

  if (!plan) {
    res.status(404).json({ error: "Training plan not found" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.completed !== undefined) updateData.completed = parsed.data.completed;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.distanceKm !== undefined) updateData.distanceKm = parsed.data.distanceKm === null ? null : String(parsed.data.distanceKm);
  if (parsed.data.durationMinutes !== undefined) updateData.durationMinutes = parsed.data.durationMinutes;

  if (Object.keys(updateData).length === 0) {
    const [session] = await db.select().from(planSessionsTable).where(eq(planSessionsTable.id, sessionId)).limit(1);
    if (!session) {
      res.status(404).json({ error: "Plan session not found" });
      return;
    }

    res.json(serializeSession(session));
    return;
  }

  const [updatedSession] = await db
    .update(planSessionsTable)
    .set(updateData)
    .where(and(eq(planSessionsTable.id, sessionId), eq(planSessionsTable.planId, planId)))
    .returning();

  if (!updatedSession) {
    res.status(404).json({ error: "Plan session not found" });
    return;
  }

  res.json(serializeSession(updatedSession));
});

router.get("/plans/:id", async (req: Request, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetTrainingPlanParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.user!.id;
  const [plan] = await db
    .select()
    .from(trainingPlansTable)
    .where(and(eq(trainingPlansTable.id, params.data.id), eq(trainingPlansTable.userId, userId)));
  if (!plan) {
    res.status(404).json({ error: "Training plan not found" });
    return;
  }
  const sessions = await db
    .select()
    .from(planSessionsTable)
    .where(eq(planSessionsTable.planId, plan.id))
    .orderBy(planSessionsTable.weekNumber, planSessionsTable.dayOfWeek);
  res.json(GetTrainingPlanResponse.parse({ ...serializePlan(plan), sessions: sessions.map(serializeSession) }));
});

router.delete("/plans/:id", async (req: Request, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteTrainingPlanParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.user!.id;
  const [plan] = await db
    .delete(trainingPlansTable)
    .where(and(eq(trainingPlansTable.id, params.data.id), eq(trainingPlansTable.userId, userId)))
    .returning();
  if (!plan) {
    res.status(404).json({ error: "Training plan not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;

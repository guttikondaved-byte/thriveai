import { Router, type Request, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, activitiesTable } from "@workspace/db";
import {
  ListActivitiesResponse,
  CreateActivityBody,
  GetActivityParams,
  GetActivityResponse,
  ListActivitiesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeActivity(a: typeof activitiesTable.$inferSelect) {
  return {
    ...a,
    distanceKm: a.distanceKm ? Number(a.distanceKm) : null,
    createdAt: a.createdAt.toISOString(),
  };
}

router.get("/activities", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const query = ListActivitiesQueryParams.safeParse(req.query);
  const limit = query.success ? (query.data.limit ?? 20) : 20;
  const userId = req.user.id;
  const activities = await db
    .select()
    .from(activitiesTable)
    .where(eq(activitiesTable.userId, userId))
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
  res.status(201).json(GetActivityResponse.parse(serializeActivity(activity)));
});

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

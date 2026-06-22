import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, injuriesTable, athleteProfileTable } from "@workspace/db";
import {
  ListInjuriesResponse,
  CreateInjuryBody,
  UpdateInjuryBody,
  DeleteInjuryParams,
  UpdateInjuryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getCurrentProfileId(): Promise<number | null> {
  const [profile] = await db.select({ id: athleteProfileTable.id }).from(athleteProfileTable).limit(1);
  return profile?.id ?? null;
}

function serializeInjury(i: typeof injuriesTable.$inferSelect) {
  return { ...i, createdAt: i.createdAt.toISOString() };
}

router.get("/injuries", async (_req, res): Promise<void> => {
  const profileId = await getCurrentProfileId();
  if (!profileId) { res.json([]); return; }
  const rows = await db
    .select()
    .from(injuriesTable)
    .where(eq(injuriesTable.profileId, profileId))
    .orderBy(desc(injuriesTable.dateOccurred));
  res.json(ListInjuriesResponse.parse(rows.map(serializeInjury)));
});

router.post("/injuries", async (req, res): Promise<void> => {
  const parsed = CreateInjuryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const profileId = await getCurrentProfileId();
  const [row] = await db
    .insert(injuriesTable)
    .values({ ...parsed.data, profileId: profileId ?? undefined })
    .returning();
  res.status(201).json(serializeInjury(row));
});

router.patch("/injuries/:id", async (req, res): Promise<void> => {
  const idParam = UpdateInjuryParams.safeParse({ id: parseInt(req.params.id as string, 10) });
  if (!idParam.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateInjuryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const profileId = await getCurrentProfileId();
  const [row] = await db
    .update(injuriesTable)
    .set(parsed.data)
    .where(and(eq(injuriesTable.id, idParam.data.id), eq(injuriesTable.profileId, profileId ?? -1)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeInjury(row));
});

router.delete("/injuries/:id", async (req, res): Promise<void> => {
  const idParam = DeleteInjuryParams.safeParse({ id: parseInt(req.params.id as string, 10) });
  if (!idParam.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const profileId = await getCurrentProfileId();
  const [row] = await db
    .delete(injuriesTable)
    .where(and(eq(injuriesTable.id, idParam.data.id), eq(injuriesTable.profileId, profileId ?? -1)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

export default router;

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

/**
 * Resolve the CURRENT user's athlete_profile id, creating the profile if needed.
 * Injuries must be scoped to the signed-in user — previously this grabbed the first
 * profile row in the whole table (no user filter), which leaked/attached injuries
 * across accounts and made a user's own injuries appear not to save.
 */
async function getOrCreateProfileId(userId: string): Promise<number> {
  const [existing] = await db
    .select({ id: athleteProfileTable.id })
    .from(athleteProfileTable)
    .where(eq(athleteProfileTable.userId, userId))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(athleteProfileTable)
    .values({ userId })
    .returning({ id: athleteProfileTable.id });
  return created.id;
}

/** Read-only profile lookup — used by GET/PATCH/DELETE so a read never creates a profile row. */
async function getProfileId(userId: string): Promise<number | null> {
  const [existing] = await db
    .select({ id: athleteProfileTable.id })
    .from(athleteProfileTable)
    .where(eq(athleteProfileTable.userId, userId))
    .limit(1);
  return existing?.id ?? null;
}

function serializeInjury(i: typeof injuriesTable.$inferSelect) {
  return { ...i, createdAt: i.createdAt.toISOString() };
}

/** The date columns use mode:"string"; generated zod parses to Date, so normalize to YYYY-MM-DD. */
function toDateString(v: Date | string): string {
  return v instanceof Date ? v.toISOString().slice(0, 10) : v;
}

router.get("/injuries", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const profileId = await getProfileId(req.user.id);
  if (!profileId) { res.json([]); return; }
  const rows = await db
    .select()
    .from(injuriesTable)
    .where(eq(injuriesTable.profileId, profileId))
    .orderBy(desc(injuriesTable.dateOccurred));
  res.json(ListInjuriesResponse.parse(rows.map(serializeInjury)));
});

router.post("/injuries", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const parsed = CreateInjuryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const profileId = await getOrCreateProfileId(req.user.id);
  const [row] = await db
    .insert(injuriesTable)
    .values({
      profileId,
      injuryType: d.injuryType,
      bodyPart: d.bodyPart,
      status: d.status,
      dateOccurred: toDateString(d.dateOccurred),
      dateRecovered: d.dateRecovered ? toDateString(d.dateRecovered) : null,
      notes: d.notes ?? null,
    })
    .returning();
  res.status(201).json(serializeInjury(row));
});

router.patch("/injuries/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const idParam = UpdateInjuryParams.safeParse({ id: parseInt(req.params.id as string, 10) });
  if (!idParam.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateInjuryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const setData: Partial<typeof injuriesTable.$inferInsert> = {};
  if (d.injuryType !== undefined) setData.injuryType = d.injuryType;
  if (d.bodyPart !== undefined) setData.bodyPart = d.bodyPart;
  if (d.status !== undefined) setData.status = d.status;
  if (d.dateOccurred !== undefined) setData.dateOccurred = toDateString(d.dateOccurred);
  if (d.dateRecovered !== undefined) setData.dateRecovered = d.dateRecovered ? toDateString(d.dateRecovered) : null;
  if (d.notes !== undefined) setData.notes = d.notes ?? null;
  if (Object.keys(setData).length === 0) { res.status(400).json({ error: "No values to update" }); return; }
  const profileId = await getProfileId(req.user.id);
  if (!profileId) { res.status(404).json({ error: "Not found" }); return; }
  const [row] = await db
    .update(injuriesTable)
    .set(setData)
    .where(and(eq(injuriesTable.id, idParam.data.id), eq(injuriesTable.profileId, profileId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeInjury(row));
});

router.delete("/injuries/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const idParam = DeleteInjuryParams.safeParse({ id: parseInt(req.params.id as string, 10) });
  if (!idParam.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const profileId = await getProfileId(req.user.id);
  if (!profileId) { res.status(404).json({ error: "Not found" }); return; }
  const [row] = await db
    .delete(injuriesTable)
    .where(and(eq(injuriesTable.id, idParam.data.id), eq(injuriesTable.profileId, profileId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

export default router;

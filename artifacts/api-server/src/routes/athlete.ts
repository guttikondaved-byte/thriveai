import { Router, type IRouter } from "express";
import { db, athleteProfileTable } from "@workspace/db";
import { GetAthleteProfileResponse, UpdateAthleteProfileBody, UpdateAthleteProfileResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/athlete/profile", async (req, res): Promise<void> => {
  let [profile] = await db.select().from(athleteProfileTable).limit(1);
  if (!profile) {
    const [created] = await db.insert(athleteProfileTable).values({
      name: "Athlete",
      fitnessLevel: "intermediate",
      primaryGoal: "Stay fit",
    }).returning();
    profile = created;
  }
  res.json(GetAthleteProfileResponse.parse({
    ...profile,
    weeklyMileageGoal: profile.weeklyMileageGoal ? Number(profile.weeklyMileageGoal) : null,
    hrv: profile.hrv ? Number(profile.hrv) : null,
    createdAt: profile.createdAt.toISOString(),
  }));
});

router.patch("/athlete/profile", async (req, res): Promise<void> => {
  const parsed = UpdateAthleteProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let [existing] = await db.select().from(athleteProfileTable).limit(1);
  if (!existing) {
    const [created] = await db.insert(athleteProfileTable).values({
      name: "Athlete",
      fitnessLevel: "intermediate",
      primaryGoal: "Stay fit",
    }).returning();
    existing = created;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.age !== undefined) updateData.age = parsed.data.age;
  if (parsed.data.weeklyMileageGoal !== undefined) updateData.weeklyMileageGoal = String(parsed.data.weeklyMileageGoal);
  if (parsed.data.fitnessLevel !== undefined) updateData.fitnessLevel = parsed.data.fitnessLevel;
  if (parsed.data.primaryGoal !== undefined) updateData.primaryGoal = parsed.data.primaryGoal;
  if (parsed.data.restingHeartRate !== undefined) updateData.restingHeartRate = parsed.data.restingHeartRate;
  if (parsed.data.hrv !== undefined) updateData.hrv = String(parsed.data.hrv);

  const { eq } = await import("drizzle-orm");
  const [updated] = await db.update(athleteProfileTable).set(updateData).where(eq(athleteProfileTable.id, existing.id)).returning();

  res.json(UpdateAthleteProfileResponse.parse({
    ...updated,
    weeklyMileageGoal: updated.weeklyMileageGoal ? Number(updated.weeklyMileageGoal) : null,
    hrv: updated.hrv ? Number(updated.hrv) : null,
    createdAt: updated.createdAt.toISOString(),
  }));
});

export default router;

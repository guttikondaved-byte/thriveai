import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, athleteProfileTable } from "@workspace/db";
import { GetAthleteProfileResponse, UpdateAthleteProfileBody, UpdateAthleteProfileResponse } from "@workspace/api-zod";

const router: IRouter = Router();

async function getOrCreateProfile(userId: string) {
  let [profile] = await db
    .select()
    .from(athleteProfileTable)
    .where(eq(athleteProfileTable.userId, userId))
    .limit(1);

  if (!profile) {
    const [created] = await db
      .insert(athleteProfileTable)
      .values({ userId, name: "Athlete", fitnessLevel: "intermediate", primaryGoal: "Stay fit" })
      .returning();
    profile = created;
  }
  return profile;
}

router.get("/athlete/profile", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.set("Cache-Control", "no-store");
  const profile = await getOrCreateProfile(req.user.id);
  res.json(GetAthleteProfileResponse.parse({
    ...profile,
    weeklyMileageGoal: profile.weeklyMileageGoal ? Number(profile.weeklyMileageGoal) : null,
    hrv: profile.hrv ? Number(profile.hrv) : null,
    createdAt: profile.createdAt.toISOString(),
  }));
});

router.patch("/athlete/profile", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = UpdateAthleteProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await getOrCreateProfile(req.user.id);

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.age !== undefined) updateData.age = parsed.data.age;
  if (parsed.data.weeklyMileageGoal !== undefined) updateData.weeklyMileageGoal = String(parsed.data.weeklyMileageGoal);
  if (parsed.data.fitnessLevel !== undefined) updateData.fitnessLevel = parsed.data.fitnessLevel;
  if (parsed.data.primaryGoal !== undefined) updateData.primaryGoal = parsed.data.primaryGoal;
  if (parsed.data.restingHeartRate !== undefined) updateData.restingHeartRate = parsed.data.restingHeartRate;
  if (parsed.data.hrv !== undefined) updateData.hrv = String(parsed.data.hrv);
  if (parsed.data.selectedCoach !== undefined) updateData.selectedCoach = parsed.data.selectedCoach;
  if (parsed.data.userRole !== undefined) updateData.userRole = parsed.data.userRole;

  const [updated] = await db
    .update(athleteProfileTable)
    .set(updateData)
    .where(eq(athleteProfileTable.id, existing.id))
    .returning();

  res.json(UpdateAthleteProfileResponse.parse({
    ...updated,
    weeklyMileageGoal: updated.weeklyMileageGoal ? Number(updated.weeklyMileageGoal) : null,
    hrv: updated.hrv ? Number(updated.hrv) : null,
    createdAt: updated.createdAt.toISOString(),
  }));
});

export default router;

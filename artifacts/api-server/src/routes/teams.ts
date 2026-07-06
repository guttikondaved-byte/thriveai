import { Router, type IRouter } from "express";
import { db, teamsTable, teamMembershipsTable, teamCoachesTable, usersTable, athleteProfileTable, notificationsTable, stravaTokensTable, activitiesTable, injuryAlertsTable } from "@workspace/db";
import { eq, and, inArray, desc, gte } from "drizzle-orm";
import crypto from "crypto";
import { syncCoachTeamSubscriptionQuantity } from "./stripe";

const router: IRouter = Router();

// A user has coach access to a team if they're its primary coach or a co-coach.
async function isTeamCoach(teamId: number, userId: string): Promise<boolean> {
  const [team] = await db.select({ coachUserId: teamsTable.coachUserId }).from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
  if (team?.coachUserId === userId) return true;
  const [co] = await db.select().from(teamCoachesTable)
    .where(and(eq(teamCoachesTable.teamId, teamId), eq(teamCoachesTable.coachUserId, userId)))
    .limit(1);
  return !!co;
}

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

router.post("/teams", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { name } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Team name is required" });
    return;
  }

  const [profile] = await db.select({ userRole: athleteProfileTable.userRole })
    .from(athleteProfileTable)
    .where(eq(athleteProfileTable.userId, req.user.id))
    .limit(1);
  if (profile?.userRole !== "coach") {
    res.status(403).json({ error: "Only coaches can create a team" });
    return;
  }

  // A coach has exactly one team. Make creation idempotent: if they already have a
  // team, return it instead of inserting a duplicate. This protects against double
  // submits, onboarding auto-create racing with a manual create, and re-onboarding.
  const [existingTeam] = await db.select().from(teamsTable)
    .where(eq(teamsTable.coachUserId, req.user.id))
    .orderBy(desc(teamsTable.createdAt))
    .limit(1);
  if (existingTeam) {
    const members = await db.select().from(teamMembershipsTable).where(eq(teamMembershipsTable.teamId, existingTeam.id));
    res.status(200).json({
      id: existingTeam.id,
      name: existingTeam.name,
      inviteCode: existingTeam.inviteCode,
      memberCount: members.length,
      createdAt: existingTeam.createdAt.toISOString(),
    });
    return;
  }

  let inviteCode = generateInviteCode();
  let attempts = 0;
  while (attempts < 5) {
    const existing = await db.select().from(teamsTable).where(eq(teamsTable.inviteCode, inviteCode)).limit(1);
    if (existing.length === 0) break;
    inviteCode = generateInviteCode();
    attempts++;
  }

  const [team] = await db.insert(teamsTable).values({
    name,
    coachUserId: req.user.id,
    inviteCode,
  }).returning();

  res.status(201).json({
    id: team.id,
    name: team.name,
    inviteCode: team.inviteCode,
    memberCount: 0,
    createdAt: team.createdAt.toISOString(),
  });
});

router.get("/teams/my", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const coachTeam = await db.select().from(teamsTable).where(eq(teamsTable.coachUserId, req.user.id)).orderBy(desc(teamsTable.createdAt)).limit(1);
  if (coachTeam.length > 0) {
    const t = coachTeam[0];
    const members = await db.select().from(teamMembershipsTable).where(eq(teamMembershipsTable.teamId, t.id));
    res.json({ team: { id: t.id, name: t.name, inviteCode: t.inviteCode, memberCount: members.length, createdAt: t.createdAt.toISOString(), isPrimaryCoach: true } });
    return;
  }

  const coCoachOf = await db.select({ teamId: teamCoachesTable.teamId })
    .from(teamCoachesTable)
    .where(eq(teamCoachesTable.coachUserId, req.user.id))
    .limit(1);
  if (coCoachOf.length > 0) {
    const [t] = await db.select().from(teamsTable).where(eq(teamsTable.id, coCoachOf[0].teamId));
    if (t) {
      const members = await db.select().from(teamMembershipsTable).where(eq(teamMembershipsTable.teamId, t.id));
      res.json({ team: { id: t.id, name: t.name, inviteCode: t.inviteCode, memberCount: members.length, createdAt: t.createdAt.toISOString(), isPrimaryCoach: false } });
      return;
    }
  }

  const membership = await db.select({ teamId: teamMembershipsTable.teamId })
    .from(teamMembershipsTable)
    .where(eq(teamMembershipsTable.athleteUserId, req.user.id))
    .limit(1);

  if (membership.length > 0) {
    const [t] = await db.select().from(teamsTable).where(eq(teamsTable.id, membership[0].teamId));
    if (t) {
      const members = await db.select().from(teamMembershipsTable).where(eq(teamMembershipsTable.teamId, t.id));
      res.json({ team: { id: t.id, name: t.name, inviteCode: t.inviteCode, memberCount: members.length, createdAt: t.createdAt.toISOString() } });
      return;
    }
  }

  res.json({ team: null });
});

router.get("/teams/invite/:inviteCode", async (req, res): Promise<void> => {
  const { inviteCode } = req.params;
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.inviteCode, inviteCode)).limit(1);
  if (!team) {
    res.status(404).json({ error: "Invite code not found" });
    return;
  }
  const members = await db.select().from(teamMembershipsTable).where(eq(teamMembershipsTable.teamId, team.id));
  res.json({ id: team.id, name: team.name, inviteCode: team.inviteCode, memberCount: members.length, createdAt: team.createdAt.toISOString() });
});

router.post("/teams/join", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { inviteCode } = req.body;
  if (!inviteCode || typeof inviteCode !== "string") {
    res.status(400).json({ error: "Invite code is required" });
    return;
  }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.inviteCode, inviteCode.toUpperCase())).limit(1);
  if (!team) {
    res.status(404).json({ error: "Invite code not found" });
    return;
  }

  const [profile] = await db.select({ userRole: athleteProfileTable.userRole })
    .from(athleteProfileTable)
    .where(eq(athleteProfileTable.userId, req.user.id))
    .limit(1);

  // A coach joining another coach's team becomes a co-coach, not an athlete member.
  if (profile?.userRole === "coach") {
    if (team.coachUserId === req.user.id) {
      res.status(400).json({ error: "This is your own team" });
      return;
    }
    const existingCoach = await db.select().from(teamCoachesTable)
      .where(and(eq(teamCoachesTable.teamId, team.id), eq(teamCoachesTable.coachUserId, req.user.id)))
      .limit(1);
    if (existingCoach.length === 0) {
      await db.insert(teamCoachesTable).values({ teamId: team.id, coachUserId: req.user.id });
      await db.insert(notificationsTable).values({
        userId: team.coachUserId,
        type: "team_join",
        title: "New co-coach joined",
        message: `${req.user.firstName ?? "A coach"} joined your team "${team.name}" as a co-coach.`,
      });
    }
    const members = await db.select().from(teamMembershipsTable).where(eq(teamMembershipsTable.teamId, team.id));
    res.json({ id: team.id, name: team.name, inviteCode: team.inviteCode, memberCount: members.length, createdAt: team.createdAt.toISOString(), role: "coach" });
    return;
  }

  const existing = await db.select().from(teamMembershipsTable)
    .where(and(eq(teamMembershipsTable.teamId, team.id), eq(teamMembershipsTable.athleteUserId, req.user.id)))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(teamMembershipsTable).values({
      teamId: team.id,
      athleteUserId: req.user.id,
      status: "active",
    });

    await db.insert(notificationsTable).values({
      userId: team.coachUserId,
      type: "team_join",
      title: "New athlete joined",
      message: `${req.user.firstName ?? "An athlete"} joined your team "${team.name}".`,
    });

    // Fire-and-forget: keep the coach's Stripe "extra athlete" quantity in
    // sync with the new roster size. Never block the join on this.
    syncCoachTeamSubscriptionQuantity(team.coachUserId).catch(() => {});
  }

  const members = await db.select().from(teamMembershipsTable).where(eq(teamMembershipsTable.teamId, team.id));
  res.json({ id: team.id, name: team.name, inviteCode: team.inviteCode, memberCount: members.length, createdAt: team.createdAt.toISOString() });
});

router.get("/teams/:teamId/members", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const teamId = Number(req.params.teamId);
  if (isNaN(teamId)) {
    res.status(400).json({ error: "Invalid team id" });
    return;
  }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
  if (!team || !(await isTeamCoach(teamId, req.user.id))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const memberships = await db.select({
    userId: teamMembershipsTable.athleteUserId,
    joinedAt: teamMembershipsTable.joinedAt,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    email: usersTable.email,
    profileName: athleteProfileTable.name,
    primaryGoal: athleteProfileTable.primaryGoal,
    fitnessLevel: athleteProfileTable.fitnessLevel,
    restingHeartRate: athleteProfileTable.restingHeartRate,
    hrv: athleteProfileTable.hrv,
  })
    .from(teamMembershipsTable)
    .innerJoin(usersTable, eq(teamMembershipsTable.athleteUserId, usersTable.id))
    .leftJoin(athleteProfileTable, eq(athleteProfileTable.userId, teamMembershipsTable.athleteUserId))
    .where(eq(teamMembershipsTable.teamId, teamId));

  const memberIds = memberships.map(m => m.userId);

  // Weekly distance + workout count per athlete (last 7 days)
  const weeklyByUser = new Map<string, number>();
  const workoutsByUser = new Map<string, number>();
  const riskByUser = new Map<string, "high" | "medium" | "low">();
  if (memberIds.length > 0) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const last7 = await db.select({
      userId: activitiesTable.userId,
      distanceKm: activitiesTable.distanceKm,
    })
      .from(activitiesTable)
      .where(and(
        inArray(activitiesTable.userId, memberIds),
        gte(activitiesTable.activityDate, sevenDaysAgo.toISOString().slice(0, 10)),
      ));
    for (const a of last7) {
      if (!a.userId) continue;
      weeklyByUser.set(a.userId, (weeklyByUser.get(a.userId) ?? 0) + Number(a.distanceKm ?? 0));
      workoutsByUser.set(a.userId, (workoutsByUser.get(a.userId) ?? 0) + 1);
    }

    // Highest active (unacknowledged) injury-alert risk per athlete
    const activeAlerts = await db.select({
      userId: injuryAlertsTable.userId,
      riskLevel: injuryAlertsTable.riskLevel,
    })
      .from(injuryAlertsTable)
      .where(and(inArray(injuryAlertsTable.userId, memberIds), eq(injuryAlertsTable.acknowledged, false)));
    const rank: Record<string, number> = { low: 1, medium: 2, high: 3 };
    for (const al of activeAlerts) {
      if (!al.userId) continue;
      const cur = riskByUser.get(al.userId);
      const lvl = (al.riskLevel as "high" | "medium" | "low");
      if (!cur || (rank[lvl] ?? 0) > (rank[cur] ?? 0)) riskByUser.set(al.userId, lvl);
    }
  }

  res.json(memberships.map(m => ({
    userId: m.userId,
    name: (m.profileName ?? `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim()) || "Athlete",
    email: m.email,
    joinedAt: m.joinedAt.toISOString(),
    primaryGoal: m.primaryGoal ?? null,
    fitnessLevel: m.fitnessLevel ?? null,
    restingHeartRate: m.restingHeartRate ?? null,
    hrv: m.hrv != null ? Number(m.hrv) : null,
    weeklyDistanceKm: weeklyByUser.get(m.userId) ?? 0,
    weeklyWorkouts: workoutsByUser.get(m.userId) ?? 0,
    riskLevel: riskByUser.get(m.userId) ?? null,
  })));
});

// GET /teams/:teamId/strava-status — coach sees which athletes have Strava connected
router.get("/teams/:teamId/strava-status", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const teamId = Number(req.params.teamId);
  if (isNaN(teamId)) {
    res.status(400).json({ error: "Invalid team id" });
    return;
  }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
  if (!team || !(await isTeamCoach(teamId, req.user.id))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const memberships = await db
    .select({ userId: teamMembershipsTable.athleteUserId })
    .from(teamMembershipsTable)
    .where(eq(teamMembershipsTable.teamId, teamId));

  const memberIds = memberships.map(m => m.userId);

  if (memberIds.length === 0) {
    res.json([]);
    return;
  }

  const stravaRows = await db
    .select({ userId: stravaTokensTable.userId, stravaAthleteId: stravaTokensTable.stravaAthleteId, updatedAt: stravaTokensTable.updatedAt })
    .from(stravaTokensTable)
    .where(inArray(stravaTokensTable.userId, memberIds));

  const stravaMap = new Map(stravaRows.map(r => [r.userId, r]));

  res.json(memberIds.map(uid => ({
    userId: uid,
    connected: stravaMap.has(uid),
    lastSync: stravaMap.get(uid)?.updatedAt?.toISOString() ?? null,
  })));
});

// GET /teams/:teamId/members/:userId/profile — coach views a single athlete's full profile
router.get("/teams/:teamId/members/:userId/profile", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const teamId = Number(req.params.teamId);
  if (isNaN(teamId)) {
    res.status(400).json({ error: "Invalid team id" });
    return;
  }
  const athleteUserId = req.params.userId;

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
  if (!team || !(await isTeamCoach(teamId, req.user.id))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [membership] = await db.select()
    .from(teamMembershipsTable)
    .where(and(eq(teamMembershipsTable.teamId, teamId), eq(teamMembershipsTable.athleteUserId, athleteUserId)))
    .limit(1);
  if (!membership) {
    res.status(404).json({ error: "Athlete is not a member of this team" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, athleteUserId)).limit(1);
  const [profile] = await db.select().from(athleteProfileTable).where(eq(athleteProfileTable.userId, athleteUserId)).limit(1);

  const recentActivities = await db.select()
    .from(activitiesTable)
    .where(eq(activitiesTable.userId, athleteUserId))
    .orderBy(desc(activitiesTable.activityDate))
    .limit(50);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const last7 = await db.select()
    .from(activitiesTable)
    .where(and(
      eq(activitiesTable.userId, athleteUserId),
      gte(activitiesTable.activityDate, sevenDaysAgo.toISOString().slice(0, 10)),
    ));
  const weeklyDistanceKm = last7.reduce((sum, a) => sum + Number(a.distanceKm ?? 0), 0);

  // All-time totals + last-8-weeks trend
  const allActivities = await db.select({
    distanceKm: activitiesTable.distanceKm,
    activityDate: activitiesTable.activityDate,
  })
    .from(activitiesTable)
    .where(eq(activitiesTable.userId, athleteUserId));
  const totalDistanceKm = allActivities.reduce((sum, a) => sum + Number(a.distanceKm ?? 0), 0);

  const weeklyTrend: Array<{ weekStart: string; distanceKm: number; workouts: number }> = [];
  for (let w = 7; w >= 0; w--) {
    const start = new Date();
    start.setDate(start.getDate() - start.getDay() - w * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    const inWeek = allActivities.filter(a => a.activityDate >= startStr && a.activityDate < endStr);
    weeklyTrend.push({
      weekStart: startStr,
      distanceKm: inWeek.reduce((sum, a) => sum + Number(a.distanceKm ?? 0), 0),
      workouts: inWeek.length,
    });
  }

  const alerts = await db.select()
    .from(injuryAlertsTable)
    .where(and(eq(injuryAlertsTable.userId, athleteUserId), eq(injuryAlertsTable.acknowledged, false)))
    .orderBy(desc(injuryAlertsTable.createdAt))
    .limit(20);

  res.json({
    userId: athleteUserId,
    name: (profile?.name ?? `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()) || "Athlete",
    email: user?.email ?? null,
    joinedAt: membership.joinedAt.toISOString(),
    profile: profile ? {
      age: profile.age,
      fitnessLevel: profile.fitnessLevel,
      primaryGoal: profile.primaryGoal,
      weeklyMileageGoal: profile.weeklyMileageGoal != null ? Number(profile.weeklyMileageGoal) : null,
      restingHeartRate: profile.restingHeartRate,
      hrv: profile.hrv != null ? Number(profile.hrv) : null,
      pr5k: profile.pr5k,
      pr10k: profile.pr10k,
      prHalf: profile.prHalf,
      prMarathon: profile.prMarathon,
      healthNotes: profile.healthNotes,
    } : null,
    weeklyDistanceKm,
    weeklyWorkouts: last7.length,
    totalActivities: allActivities.length,
    totalDistanceKm,
    weeklyTrend,
    recentActivities: recentActivities.map(a => ({
      id: a.id,
      type: a.type,
      distanceKm: a.distanceKm != null ? Number(a.distanceKm) : null,
      durationMinutes: a.durationMinutes,
      avgHeartRate: a.avgHeartRate,
      maxHeartRate: a.maxHeartRate,
      perceivedEffort: a.perceivedEffort,
      activityDate: a.activityDate,
      elevationGainM: a.elevationGainM != null ? Number(a.elevationGainM) : null,
      avgSpeed: a.avgSpeed != null ? Number(a.avgSpeed) : null,
      movingTimeSeconds: a.movingTimeSeconds,
      calories: a.calories != null ? Number(a.calories) : null,
      sufferScore: a.sufferScore,
      notes: a.notes,
      description: a.description,
    })),
    alerts: alerts.map(al => ({
      id: al.id,
      riskLevel: al.riskLevel,
      bodyPart: al.bodyPart,
      message: al.message,
      recommendation: al.recommendation,
      createdAt: al.createdAt.toISOString(),
    })),
  });
});

// PATCH /teams/code — coach regenerates their team's invite code
router.patch("/teams/code", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [team] = await db.select().from(teamsTable)
    .where(eq(teamsTable.coachUserId, req.user.id))
    .orderBy(desc(teamsTable.createdAt))
    .limit(1);

  if (!team) {
    res.status(404).json({ error: "No team found for this coach" });
    return;
  }

  let newCode = generateInviteCode();
  let attempts = 0;
  while (attempts < 5) {
    const existing = await db.select().from(teamsTable)
      .where(eq(teamsTable.inviteCode, newCode))
      .limit(1);
    if (existing.length === 0) break;
    newCode = generateInviteCode();
    attempts++;
  }

  const [updated] = await db.update(teamsTable)
    .set({ inviteCode: newCode })
    .where(eq(teamsTable.id, team.id))
    .returning();

  res.json({ inviteCode: updated.inviteCode });
});

// DELETE /teams — coach deletes their team (removes all memberships first)
router.delete("/teams", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [team] = await db.select().from(teamsTable)
    .where(eq(teamsTable.coachUserId, req.user.id))
    .orderBy(desc(teamsTable.createdAt))
    .limit(1);

  if (!team) {
    res.status(404).json({ error: "No team found for this coach" });
    return;
  }

  await db.delete(teamMembershipsTable)
    .where(eq(teamMembershipsTable.teamId, team.id));

  await db.delete(teamsTable)
    .where(eq(teamsTable.id, team.id));

  syncCoachTeamSubscriptionQuantity(req.user.id).catch(() => {});

  res.status(204).end();
});

// DELETE /teams/leave — athlete leaves their current team
router.delete("/teams/leave", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const deleted = await db.delete(teamMembershipsTable)
    .where(eq(teamMembershipsTable.athleteUserId, req.user.id))
    .returning();

  if (deleted.length > 0) {
    const [team] = await db.select({ coachUserId: teamsTable.coachUserId })
      .from(teamsTable)
      .where(eq(teamsTable.id, deleted[0].teamId))
      .limit(1);
    if (team) syncCoachTeamSubscriptionQuantity(team.coachUserId).catch(() => {});

    res.status(204).end();
    return;
  }

  // Not an athlete member — check if they're leaving as a co-coach instead.
  const deletedCoach = await db.delete(teamCoachesTable)
    .where(eq(teamCoachesTable.coachUserId, req.user.id))
    .returning();

  if (deletedCoach.length === 0) {
    res.status(404).json({ error: "You are not a member of any team" });
    return;
  }

  res.status(204).end();
});

export default router;

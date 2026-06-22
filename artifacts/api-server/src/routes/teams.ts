import { Router, type IRouter } from "express";
import { db, teamsTable, teamMembershipsTable, usersTable, athleteProfileTable, notificationsTable, stravaTokensTable, activitiesTable, injuryAlertsTable } from "@workspace/db";
import { eq, and, inArray, desc, gte } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

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

  const coachTeam = await db.select().from(teamsTable).where(eq(teamsTable.coachUserId, req.user.id)).limit(1);
  if (coachTeam.length > 0) {
    const t = coachTeam[0];
    const members = await db.select().from(teamMembershipsTable).where(eq(teamMembershipsTable.teamId, t.id));
    res.json({ team: { id: t.id, name: t.name, inviteCode: t.inviteCode, memberCount: members.length, createdAt: t.createdAt.toISOString() } });
    return;
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
  if (!team || team.coachUserId !== req.user.id) {
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
  })
    .from(teamMembershipsTable)
    .innerJoin(usersTable, eq(teamMembershipsTable.athleteUserId, usersTable.id))
    .leftJoin(athleteProfileTable, eq(athleteProfileTable.userId, teamMembershipsTable.athleteUserId))
    .where(eq(teamMembershipsTable.teamId, teamId));

  res.json(memberships.map(m => ({
    userId: m.userId,
    name: (m.profileName ?? `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim()) || "Athlete",
    email: m.email,
    joinedAt: m.joinedAt.toISOString(),
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
  if (!team || team.coachUserId !== req.user.id) {
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
  if (!team || team.coachUserId !== req.user.id) {
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
    .limit(10);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const last7 = await db.select()
    .from(activitiesTable)
    .where(and(
      eq(activitiesTable.userId, athleteUserId),
      gte(activitiesTable.activityDate, sevenDaysAgo.toISOString().slice(0, 10)),
    ));
  const weeklyDistanceKm = last7.reduce((sum, a) => sum + Number(a.distanceKm ?? 0), 0);

  const alerts = await db.select()
    .from(injuryAlertsTable)
    .where(and(eq(injuryAlertsTable.userId, athleteUserId), eq(injuryAlertsTable.acknowledged, false)))
    .orderBy(desc(injuryAlertsTable.createdAt))
    .limit(5);

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
    recentActivities: recentActivities.map(a => ({
      id: a.id,
      type: a.type,
      distanceKm: a.distanceKm != null ? Number(a.distanceKm) : null,
      durationMinutes: a.durationMinutes,
      avgHeartRate: a.avgHeartRate,
      perceivedEffort: a.perceivedEffort,
      activityDate: a.activityDate,
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

export default router;

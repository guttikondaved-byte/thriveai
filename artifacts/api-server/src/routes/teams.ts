import { Router, type IRouter } from "express";
import { db, teamsTable, teamMembershipsTable, usersTable, athleteProfileTable, notificationsTable, stravaTokensTable, activitiesTable, injuryAlertsTable, coachProfileTable } from "@workspace/db";
import { eq, and, inArray, desc, gte } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

// ===== COACH PROFILE ROUTES =====

// GET /coach/profile — get coach's profile info
router.get("/coach/profile", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [profile] = await db.select({ userRole: athleteProfileTable.userRole })
    .from(athleteProfileTable)
    .where(eq(athleteProfileTable.userId, req.user.id))
    .limit(1);
  
  if (profile?.userRole !== "coach") {
    res.status(403).json({ error: "Only coaches can access this endpoint" });
    return;
  }

  const [coachProfile] = await db.select().from(coachProfileTable)
    .where(eq(coachProfileTable.userId, req.user.id))
    .limit(1);

  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.id, req.user.id))
    .limit(1);

  // Get stats
  const teams = await db.select().from(teamsTable)
    .where(eq(teamsTable.coachUserId, req.user.id));

  let totalAthletes = 0;
  if (teams.length > 0) {
    const teamIds = teams.map(t => t.id);
    const members = await db.select()
      .from(teamMembershipsTable)
      .where(inArray(teamMembershipsTable.teamId, teamIds));
    totalAthletes = members.length;
  }

  res.json({
    userId: req.user.id,
    email: user?.email ?? null,
    firstName: user?.firstName ?? null,
    lastName: user?.lastName ?? null,
    profileImageUrl: user?.profileImageUrl ?? null,
    bio: coachProfile?.bio ?? null,
    certifications: coachProfile?.certifications ? JSON.parse(coachProfile.certifications) : [],
    experience: coachProfile?.experience ?? null,
    specialties: coachProfile?.specialties ? JSON.parse(coachProfile.specialties) : [],
    teamsManaged: teams.length,
    athletesCached: totalAthletes,
  });
});

// POST /coach/profile — create or update coach profile
router.post("/coach/profile", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [profile] = await db.select({ userRole: athleteProfileTable.userRole })
    .from(athleteProfileTable)
    .where(eq(athleteProfileTable.userId, req.user.id))
    .limit(1);
  
  if (profile?.userRole !== "coach") {
    res.status(403).json({ error: "Only coaches can access this endpoint" });
    return;
  }

  const { bio, certifications, experience, specialties } = req.body;

  const existing = await db.select().from(coachProfileTable)
    .where(eq(coachProfileTable.userId, req.user.id))
    .limit(1);

  let result;
  if (existing.length > 0) {
    [result] = await db.update(coachProfileTable)
      .set({
        bio,
        certifications: certifications ? JSON.stringify(certifications) : null,
        experience,
        specialties: specialties ? JSON.stringify(specialties) : null,
      })
      .where(eq(coachProfileTable.userId, req.user.id))
      .returning();
  } else {
    [result] = await db.insert(coachProfileTable).values({
      userId: req.user.id,
      bio,
      certifications: certifications ? JSON.stringify(certifications) : null,
      experience,
      specialties: specialties ? JSON.stringify(specialties) : null,
    }).returning();
  }

  res.json({
    userId: result.userId,
    bio: result.bio,
    certifications: result.certifications ? JSON.parse(result.certifications) : [],
    experience: result.experience,
    specialties: result.specialties ? JSON.parse(result.specialties) : [],
  });
});

// ===== TEAM ROUTES =====

// POST /teams — create a new team for coach
router.post("/teams", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { name, category } = req.body;
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
    category: category ?? "General Running",
    coachUserId: req.user.id,
    inviteCode,
  }).returning();

  res.status(201).json({
    id: team.id,
    name: team.name,
    category: team.category,
    inviteCode: team.inviteCode,
    memberCount: 0,
    createdAt: team.createdAt.toISOString(),
  });
});

// GET /coach/teams — list all teams managed by this coach
router.get("/coach/teams", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [profile] = await db.select({ userRole: athleteProfileTable.userRole })
    .from(athleteProfileTable)
    .where(eq(athleteProfileTable.userId, req.user.id))
    .limit(1);
  
  if (profile?.userRole !== "coach") {
    res.status(403).json({ error: "Only coaches can access this endpoint" });
    return;
  }

  const teams = await db.select().from(teamsTable)
    .where(eq(teamsTable.coachUserId, req.user.id))
    .orderBy(desc(teamsTable.createdAt));

  const result = [];
  for (const team of teams) {
    const members = await db.select().from(teamMembershipsTable)
      .where(eq(teamMembershipsTable.teamId, team.id));
    result.push({
      id: team.id,
      name: team.name,
      category: team.category,
      inviteCode: team.inviteCode,
      memberCount: members.length,
      createdAt: team.createdAt.toISOString(),
    });
  }

  res.json(result);
});

// GET /teams/my — get user's current team (backward compatibility)
router.get("/teams/my", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Check if user is a coach
  const coachTeam = await db.select().from(teamsTable)
    .where(eq(teamsTable.coachUserId, req.user.id))
    .orderBy(desc(teamsTable.createdAt))
    .limit(1);
  
  if (coachTeam.length > 0) {
    const t = coachTeam[0];
    const members = await db.select().from(teamMembershipsTable)
      .where(eq(teamMembershipsTable.teamId, t.id));
    res.json({ team: { id: t.id, name: t.name, category: t.category, inviteCode: t.inviteCode, memberCount: members.length, createdAt: t.createdAt.toISOString() } });
    return;
  }

  // Check if user is an athlete member
  const membership = await db.select({ teamId: teamMembershipsTable.teamId })
    .from(teamMembershipsTable)
    .where(eq(teamMembershipsTable.athleteUserId, req.user.id))
    .limit(1);

  if (membership.length > 0) {
    const [t] = await db.select().from(teamsTable)
      .where(eq(teamsTable.id, membership[0].teamId));
    if (t) {
      const members = await db.select().from(teamMembershipsTable)
        .where(eq(teamMembershipsTable.teamId, t.id));
      res.json({ team: { id: t.id, name: t.name, category: t.category, inviteCode: t.inviteCode, memberCount: members.length, createdAt: t.createdAt.toISOString() } });
      return;
    }
  }

  res.json({ team: null });
});

// PATCH /teams/:teamId — update team (name, category)
router.patch("/teams/:teamId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const teamId = Number(req.params.teamId);
  if (isNaN(teamId)) {
    res.status(400).json({ error: "Invalid team id" });
    return;
  }

  const [team] = await db.select().from(teamsTable)
    .where(eq(teamsTable.id, teamId))
    .limit(1);

  if (!team || team.coachUserId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { name, category } = req.body;
  const updates: Partial<typeof teamsTable.$inferInsert> = {};
  
  if (name) updates.name = name;
  if (category) updates.category = category;

  const [updated] = await db.update(teamsTable)
    .set(updates)
    .where(eq(teamsTable.id, teamId))
    .returning();

  const members = await db.select().from(teamMembershipsTable)
    .where(eq(teamMembershipsTable.teamId, teamId));

  res.json({
    id: updated.id,
    name: updated.name,
    category: updated.category,
    inviteCode: updated.inviteCode,
    memberCount: members.length,
    createdAt: updated.createdAt.toISOString(),
  });
});

// GET /teams/invite/:inviteCode — verify invite code exists
router.get("/teams/invite/:inviteCode", async (req, res): Promise<void> => {
  const { inviteCode } = req.params;
  const [team] = await db.select().from(teamsTable)
    .where(eq(teamsTable.inviteCode, inviteCode.toUpperCase()))
    .limit(1);
  if (!team) {
    res.status(404).json({ error: "Invite code not found" });
    return;
  }
  const members = await db.select().from(teamMembershipsTable)
    .where(eq(teamMembershipsTable.teamId, team.id));
  res.json({ 
    id: team.id, 
    name: team.name, 
    category: team.category,
    inviteCode: team.inviteCode, 
    memberCount: members.length, 
    createdAt: team.createdAt.toISOString() 
  });
});

// POST /teams/join — athlete joins team via invite code
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

  const [team] = await db.select().from(teamsTable)
    .where(eq(teamsTable.inviteCode, inviteCode.toUpperCase()))
    .limit(1);
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

  const members = await db.select().from(teamMembershipsTable)
    .where(eq(teamMembershipsTable.teamId, team.id));
  res.json({ 
    id: team.id, 
    name: team.name, 
    category: team.category,
    inviteCode: team.inviteCode, 
    memberCount: members.length, 
    createdAt: team.createdAt.toISOString() 
  });
});

// GET /teams/:teamId/members — get roster with stats
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

  // Weekly distance per athlete (last 7 days)
  const weeklyByUser = new Map<string, number>();
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

// GET /teams/:teamId/members/:userId/profile — coach views athlete's full profile
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

// PATCH /teams/:teamId/code — regenerate invite code for a team
router.patch("/teams/:teamId/code", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const teamId = Number(req.params.teamId);
  if (isNaN(teamId)) {
    res.status(400).json({ error: "Invalid team id" });
    return;
  }

  const [team] = await db.select().from(teamsTable)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.coachUserId, req.user.id)))
    .limit(1);

  if (!team) {
    res.status(404).json({ error: "Team not found" });
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
    .where(eq(teamsTable.id, teamId))
    .returning();

  res.json({ inviteCode: updated.inviteCode });
});

// DELETE /teams/:teamId — delete a specific team
router.delete("/teams/:teamId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const teamId = Number(req.params.teamId);
  if (isNaN(teamId)) {
    res.status(400).json({ error: "Invalid team id" });
    return;
  }

  const [team] = await db.select().from(teamsTable)
    .where(eq(teamsTable.id, teamId))
    .limit(1);

  if (!team || team.coachUserId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(teamMembershipsTable)
    .where(eq(teamMembershipsTable.teamId, teamId));

  await db.delete(teamsTable)
    .where(eq(teamsTable.id, teamId));

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

  if (deleted.length === 0) {
    res.status(404).json({ error: "You are not a member of any team" });
    return;
  }

  res.status(204).end();
});

export default router;

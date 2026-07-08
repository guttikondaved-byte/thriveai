import { Router, type Request, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, injuryAlertsTable, injuryAlertCommentsTable, teamMembershipsTable, teamsTable, teamCoachesTable, notificationsTable } from "@workspace/db";
import {
  ListInjuryAlertsResponse,
  AcknowledgeAlertParams,
  AcknowledgeAlertResponse,
  ListAlertCommentsParams,
  ListAlertCommentsResponse,
  ListAlertCommentsResponseItem,
  CreateAlertCommentParams,
  CreateAlertCommentBody,
} from "@workspace/api-zod";
import { isTeamCoach } from "./teams";

const router: IRouter = Router();

function serializeAlert(a: typeof injuryAlertsTable.$inferSelect) {
  return {
    ...a,
    createdAt: a.createdAt.toISOString(),
  };
}

function serializeComment(c: typeof injuryAlertCommentsTable.$inferSelect) {
  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
  };
}

// True if `coachUserId` coaches (primary or co-coach) any team `athleteUserId` belongs to.
async function isCoachOfAthlete(coachUserId: string, athleteUserId: string): Promise<boolean> {
  const memberships = await db
    .select({ teamId: teamMembershipsTable.teamId })
    .from(teamMembershipsTable)
    .where(eq(teamMembershipsTable.athleteUserId, athleteUserId));
  for (const m of memberships) {
    if (await isTeamCoach(m.teamId, coachUserId)) return true;
  }
  return false;
}

// All coach user ids (primary + co-coaches) across every team `athleteUserId`
// belongs to — used to notify the whole care team on an athlete's reply.
async function coachUserIdsForAthlete(athleteUserId: string): Promise<string[]> {
  const memberships = await db
    .select({ teamId: teamMembershipsTable.teamId })
    .from(teamMembershipsTable)
    .where(eq(teamMembershipsTable.athleteUserId, athleteUserId));

  const coachIds = new Set<string>();
  for (const m of memberships) {
    const [team] = await db.select({ coachUserId: teamsTable.coachUserId }).from(teamsTable).where(eq(teamsTable.id, m.teamId)).limit(1);
    if (team) coachIds.add(team.coachUserId);
    const coCoaches = await db.select({ coachUserId: teamCoachesTable.coachUserId }).from(teamCoachesTable).where(eq(teamCoachesTable.teamId, m.teamId));
    for (const c of coCoaches) coachIds.add(c.coachUserId);
  }
  return Array.from(coachIds);
}

router.get("/alerts", async (req: Request, res): Promise<void> => {
  const userId = req.user!.id;
  const alerts = await db
    .select()
    .from(injuryAlertsTable)
    .where(eq(injuryAlertsTable.userId, userId))
    .orderBy(injuryAlertsTable.createdAt);
  res.json(ListInjuryAlertsResponse.parse(alerts.map(serializeAlert)));
});

router.post("/alerts/:id/acknowledge", async (req: Request, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AcknowledgeAlertParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.user!.id;
  const [alert] = await db
    .update(injuryAlertsTable)
    .set({ acknowledged: true })
    .where(and(eq(injuryAlertsTable.id, params.data.id), eq(injuryAlertsTable.userId, userId)))
    .returning();
  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  res.json(AcknowledgeAlertResponse.parse(serializeAlert(alert)));
});

// GET /alerts/:id/comments — the athlete who owns the alert, or a coach of
// their team, can read the comment thread a coach has left on it.
router.get("/alerts/:id/comments", async (req: Request, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ListAlertCommentsParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [alert] = await db.select().from(injuryAlertsTable).where(eq(injuryAlertsTable.id, params.data.id)).limit(1);
  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  const userId = req.user!.id;
  if (alert.userId !== userId && !(await isCoachOfAthlete(userId, alert.userId!))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const comments = await db
    .select()
    .from(injuryAlertCommentsTable)
    .where(eq(injuryAlertCommentsTable.alertId, params.data.id))
    .orderBy(injuryAlertCommentsTable.createdAt);
  res.json(ListAlertCommentsResponse.parse(comments.map(serializeComment)));
});

// POST /alerts/:id/comments — either a coach of the athlete's team, or the
// athlete themselves, can post into the thread. Notifies whichever side
// didn't write the message.
router.post("/alerts/:id/comments", async (req: Request, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = CreateAlertCommentParams.safeParse({ id: parseInt(raw, 10) });
  const body = CreateAlertCommentBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: (params.error ?? body.error)!.message });
    return;
  }
  const [alert] = await db.select().from(injuryAlertsTable).where(eq(injuryAlertsTable.id, params.data.id)).limit(1);
  if (!alert || !alert.userId) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  const authorUserId = req.user!.id;
  const isAthlete = alert.userId === authorUserId;
  const isCoach = !isAthlete && (await isCoachOfAthlete(authorUserId, alert.userId));
  if (!isAthlete && !isCoach) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const authorRole = isAthlete ? "athlete" : "coach";

  const [comment] = await db
    .insert(injuryAlertCommentsTable)
    .values({ alertId: params.data.id, authorUserId, authorRole, content: body.data.content })
    .returning();

  if (authorRole === "coach") {
    await db.insert(notificationsTable).values({
      userId: alert.userId,
      type: "alert_comment",
      title: "Your coach left a note",
      message: `Your coach commented on your ${alert.bodyPart} alert: "${body.data.content}"`,
    });
  } else {
    const coachIds = await coachUserIdsForAthlete(alert.userId);
    if (coachIds.length > 0) {
      await db.insert(notificationsTable).values(
        coachIds.map((coachUserId) => ({
          userId: coachUserId,
          type: "alert_comment",
          title: "New reply on an athlete's alert",
          message: `Reply on their ${alert.bodyPart} alert: "${body.data.content}"`,
        })),
      );
    }
  }

  res.status(201).json(ListAlertCommentsResponseItem.parse(serializeComment(comment)));
});

export default router;

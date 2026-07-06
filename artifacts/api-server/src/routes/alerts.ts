import { Router, type Request, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, injuryAlertsTable, injuryAlertCommentsTable, teamMembershipsTable, notificationsTable } from "@workspace/db";
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

// POST /alerts/:id/comments — a coach of the athlete's team leaves a note on
// one of their alerts. Read-only for the athlete (they see it, don't reply here).
router.post("/alerts/:id/comments", async (req: Request, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = CreateAlertCommentParams.safeParse({ id: parseInt(raw, 10) });
  const body = CreateAlertCommentBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: (params.error ?? body.error)!.message });
    return;
  }
  const [alert] = await db.select().from(injuryAlertsTable).where(eq(injuryAlertsTable.id, params.data.id)).limit(1);
  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  const coachUserId = req.user!.id;
  if (!alert.userId || !(await isCoachOfAthlete(coachUserId, alert.userId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const [comment] = await db
    .insert(injuryAlertCommentsTable)
    .values({ alertId: params.data.id, coachUserId, content: body.data.content })
    .returning();
  await db.insert(notificationsTable).values({
    userId: alert.userId,
    type: "alert_comment",
    title: "Your coach left a note",
    message: `Your coach commented on your ${alert.bodyPart} alert: "${body.data.content}"`,
  });
  res.status(201).json(ListAlertCommentsResponseItem.parse(serializeComment(comment)));
});

export default router;

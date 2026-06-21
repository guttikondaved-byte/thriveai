import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, injuryAlertsTable } from "@workspace/db";
import {
  ListInjuryAlertsResponse,
  AcknowledgeAlertParams,
  AcknowledgeAlertResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeAlert(a: typeof injuryAlertsTable.$inferSelect) {
  return {
    ...a,
    createdAt: a.createdAt.toISOString(),
  };
}

router.get("/alerts", async (_req, res): Promise<void> => {
  const alerts = await db.select().from(injuryAlertsTable).orderBy(injuryAlertsTable.createdAt);
  res.json(ListInjuryAlertsResponse.parse(alerts.map(serializeAlert)));
});

router.post("/alerts/:id/acknowledge", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AcknowledgeAlertParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [alert] = await db.update(injuryAlertsTable).set({ acknowledged: true }).where(eq(injuryAlertsTable.id, params.data.id)).returning();
  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  res.json(AcknowledgeAlertResponse.parse(serializeAlert(alert)));
});

export default router;

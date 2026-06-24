import { Router, type IRouter } from "express";
import { db, stravaTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  getValidStravaToken,
  syncStravaActivity,
  registerStravaWebhook,
  getStravaWebhookSubscription,
  getWebhookCallbackUrl,
} from "../lib/strava";

const STRAVA_OAUTH_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";

const router: IRouter = Router();

// ── OAuth: redirect user to Strava ─────────────────────────────────────────

function getCallbackUrl(): string {
  // APP_PUBLIC_URL is the user-facing origin (Netlify in production, vite
  // dev server locally). Strava redirects the browser to this URL, which
  // hits Netlify's /api/* proxy and forwards to the api-server.
  const base = process.env.APP_PUBLIC_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  return `${base}/api/strava/callback`;
}

router.get("/strava/connect", (req, res): void => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const callbackUrl = getCallbackUrl();
  req.log.info({ callbackUrl }, "Strava connect redirect_uri");

  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID ?? "",
    redirect_uri: callbackUrl,
    response_type: "code",
    approval_prompt: "auto",
    scope: "activity:read_all,profile:read_all",
  });

  res.redirect(`${STRAVA_OAUTH_URL}?${params.toString()}`);
});

// ── OAuth: Strava callback ──────────────────────────────────────────────────

router.get("/strava/callback", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.redirect("/api/login");
    return;
  }

  const code = req.query.code as string | undefined;
  const error = req.query.error as string | undefined;

  if (error || !code) {
    res.redirect("/?strava=denied");
    return;
  }

  const callbackUrl = getCallbackUrl();

  const tokenResp = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: callbackUrl,
    }),
  });

  if (!tokenResp.ok) {
    req.log.error({ status: tokenResp.status }, "Strava token exchange failed");
    res.redirect("/activities?strava=error");
    return;
  }

  const data = (await tokenResp.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    scope: string;
    athlete: { id: number };
  };

  const userId = req.user!.id;

  await db
    .insert(stravaTokensTable)
    .values({
      userId,
      stravaAthleteId: BigInt(data.athlete.id),
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
      scope: data.scope,
    })
    .onConflictDoUpdate({
      target: stravaTokensTable.userId,
      set: {
        stravaAthleteId: BigInt(data.athlete.id),
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
        scope: data.scope,
        updatedAt: new Date(),
      },
    });

  req.log.info({ userId }, "Strava connected");
  res.redirect("/activities?strava=connected");
});

// ── Status: is this user connected? ────────────────────────────────────────

router.get("/strava/status", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [token] = await db
    .select({ id: stravaTokensTable.id, stravaAthleteId: stravaTokensTable.stravaAthleteId })
    .from(stravaTokensTable)
    .where(eq(stravaTokensTable.userId, req.user!.id));

  res.json({ connected: !!token, stravaAthleteId: token?.stravaAthleteId ?? null });
});

// ── Disconnect ──────────────────────────────────────────────────────────────

router.delete("/strava/disconnect", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  await db
    .delete(stravaTokensTable)
    .where(eq(stravaTokensTable.userId, req.user!.id));

  res.json({ success: true });
});

// ── Webhook: Strava GET verification ───────────────────────────────────────
// Strava calls this when you register the webhook subscription.
// Must respond with hub.challenge to confirm ownership.

router.get("/strava/webhook", (req, res): void => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const expected = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ?? "thrive_strava_verify_2024";

  if (mode === "subscribe" && token === expected) {
    res.json({ "hub.challenge": challenge });
  } else {
    res.status(403).json({ error: "Verification failed" });
  }
});

// ── Webhook: Strava POST events ─────────────────────────────────────────────
// Strava posts here whenever an athlete creates/updates/deletes an activity.

router.post("/strava/webhook", async (req, res): Promise<void> => {
  // Always respond 200 immediately — Strava retries if we're slow
  res.sendStatus(200);

  const event = req.body as {
    aspect_type: string;
    event_time: number;
    object_id: number;
    object_type: string;
    owner_id: number;
    subscription_id: number;
  };

  req.log.info({ event }, "Strava webhook event received");

  // Only handle new/updated activities (not athlete events or deletions)
  if (event.object_type !== "activity" || event.aspect_type === "delete") return;

  // Look up which user owns this Strava athlete ID
  const [token] = await db
    .select({ userId: stravaTokensTable.userId })
    .from(stravaTokensTable)
    .where(eq(stravaTokensTable.stravaAthleteId, BigInt(event.owner_id)));

  if (!token) {
    req.log.warn({ owner_id: event.owner_id }, "No user found for Strava athlete");
    return;
  }

  await syncStravaActivity(token.userId, event.object_id);
});

// ── Admin: register / view webhook subscription ─────────────────────────────

router.post("/strava/webhook/subscribe", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const result = await registerStravaWebhook();
  res.json({ callbackUrl: getWebhookCallbackUrl(), result });
});

router.get("/strava/webhook/subscription", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const data = await getStravaWebhookSubscription();
  res.json(data);
});

// ── Manual sync: pull latest N activities from Strava ──────────────────────

router.post("/strava/sync", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = req.user!.id;
  const accessToken = await getValidStravaToken(userId);
  if (!accessToken) {
    res.status(400).json({ error: "Strava not connected" });
    return;
  }

  const resp = await fetch(
    "https://www.strava.com/api/v3/athlete/activities?per_page=30",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!resp.ok) {
    res.status(502).json({ error: "Failed to fetch Strava activities" });
    return;
  }

  const activities = (await resp.json()) as Array<{ id: number }>;
  let synced = 0;

  for (const act of activities) {
    await syncStravaActivity(userId, act.id);
    synced++;
  }

  res.json({ synced });
});

export default router;

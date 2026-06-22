import { db, stravaTokensTable, activitiesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";

const TYPE_MAP: Record<string, string> = {
  Run: "easy_run",
  TrailRun: "easy_run",
  VirtualRun: "easy_run",
  Walk: "easy_run",
  Hike: "easy_run",
  Ride: "cross_training",
  VirtualRide: "cross_training",
  Swim: "cross_training",
  Workout: "cross_training",
  WeightTraining: "cross_training",
  Yoga: "cross_training",
  Crossfit: "cross_training",
};

export async function getValidStravaToken(userId: string): Promise<string | null> {
  const [token] = await db
    .select()
    .from(stravaTokensTable)
    .where(eq(stravaTokensTable.userId, userId));

  if (!token) return null;

  const now = Math.floor(Date.now() / 1000);
  if (token.expiresAt > now + 60) return token.accessToken;

  // Token expired — refresh it
  const resp = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    }),
  });

  if (!resp.ok) {
    logger.error({ status: resp.status }, "Strava token refresh failed");
    return null;
  }

  const data = (await resp.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };

  await db
    .update(stravaTokensTable)
    .set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
      updatedAt: new Date(),
    })
    .where(eq(stravaTokensTable.userId, userId));

  return data.access_token;
}

export async function syncStravaActivity(
  userId: string,
  stravaActivityId: number,
): Promise<void> {
  const accessToken = await getValidStravaToken(userId);
  if (!accessToken) {
    logger.warn({ userId }, "No valid Strava token for activity sync");
    return;
  }

  // Avoid duplicate imports
  const existing = await db
    .select({ id: activitiesTable.id })
    .from(activitiesTable)
    .where(
      and(
        eq(activitiesTable.userId, userId),
        eq(activitiesTable.stravaActivityId, BigInt(stravaActivityId)),
      ),
    );
  if (existing.length > 0) return;

  const resp = await fetch(`${STRAVA_API_BASE}/activities/${stravaActivityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    logger.error({ status: resp.status, stravaActivityId }, "Failed to fetch Strava activity");
    return;
  }

  const act = (await resp.json()) as {
    type: string;
    distance: number;
    moving_time: number;
    average_heartrate?: number;
    name?: string;
    start_date_local?: string;
  };

  const activityType = TYPE_MAP[act.type] ?? "easy_run";
  const distanceKm = act.distance ? String((act.distance / 1609.344).toFixed(2)) : undefined;
  const durationMinutes = act.moving_time ? Math.round(act.moving_time / 60) : undefined;
  const activityDate = act.start_date_local
    ? act.start_date_local.substring(0, 10)
    : new Date().toISOString().substring(0, 10);

  await db.insert(activitiesTable).values({
    userId,
    stravaActivityId: BigInt(stravaActivityId),
    type: activityType,
    ...(distanceKm ? { distanceKm } : {}),
    ...(durationMinutes ? { durationMinutes } : {}),
    ...(act.average_heartrate ? { avgHeartRate: Math.round(act.average_heartrate) } : {}),
    ...(act.name ? { notes: act.name } : {}),
    activityDate,
  });

  logger.info({ userId, stravaActivityId }, "Synced Strava activity");
}

export function getWebhookCallbackUrl(): string {
  const domains = process.env.REPLIT_DOMAINS;
  const primary = domains ? domains.split(",")[0]!.trim() : process.env.REPLIT_DEV_DOMAIN;
  return `https://${primary}/api/strava/webhook`;
}

export async function registerStravaWebhook(): Promise<{ id: number } | { error: string }> {
  const callbackUrl = getWebhookCallbackUrl();
  const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ?? "thrive_strava_verify_2024";

  const resp = await fetch(`${STRAVA_API_BASE}/push_subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      callback_url: callbackUrl,
      verify_token: verifyToken,
    }),
  });

  const data = (await resp.json()) as Record<string, unknown>;
  if (!resp.ok) {
    logger.error({ data }, "Strava webhook subscription failed");
    return { error: JSON.stringify(data) };
  }

  logger.info({ data, callbackUrl }, "Strava webhook registered");
  return data as { id: number };
}

export async function getStravaWebhookSubscription(): Promise<unknown> {
  const resp = await fetch(
    `${STRAVA_API_BASE}/push_subscriptions?client_id=${process.env.STRAVA_CLIENT_ID}&client_secret=${process.env.STRAVA_CLIENT_SECRET}`,
  );
  return resp.json();
}

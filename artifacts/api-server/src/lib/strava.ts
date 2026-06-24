import { db, stravaTokensTable, activitiesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";
import { recalculateInjuryRisk } from "./injuryRisk";

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";

// Thrive is a running app — only running activities are imported from Strava.
// Rides, swims, weight training, yoga, etc. are intentionally skipped.
const RUN_TYPE_MAP: Record<string, string> = {
  Run: "easy_run",
  TrailRun: "easy_run",
  VirtualRun: "easy_run",
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

  type StravaSplit = {
    split: number;
    distance: number;
    elapsed_time: number;
    moving_time: number;
    elevation_difference: number | null;
    average_speed: number;
    average_heartrate?: number | null;
    pace_zone?: number | null;
  };
  type StravaBestEffort = {
    name: string;
    elapsed_time: number;
    distance: number;
  };
  const act = (await resp.json()) as {
    type: string;
    sport_type?: string;
    distance: number;
    moving_time: number;
    elapsed_time?: number;
    average_heartrate?: number;
    max_heartrate?: number;
    average_cadence?: number;
    average_speed?: number;
    max_speed?: number;
    average_watts?: number;
    calories?: number;
    suffer_score?: number;
    average_temp?: number;
    total_elevation_gain?: number;
    elev_high?: number;
    elev_low?: number;
    achievement_count?: number;
    pr_count?: number;
    kudos_count?: number;
    comment_count?: number;
    athlete_count?: number;
    workout_type?: number | null;
    name?: string;
    description?: string;
    start_date_local?: string;
    timezone?: string;
    gear?: { name?: string } | null;
    map?: { summary_polyline?: string; polyline?: string } | null;
    splits_standard?: StravaSplit[];
    best_efforts?: StravaBestEffort[];
  };

  // Only import running activities — skip rides, swims, weights, yoga, etc.
  const activityType = RUN_TYPE_MAP[act.type];
  if (!activityType) {
    logger.info({ userId, stravaActivityId, type: act.type }, "Skipping non-running Strava activity");
    return;
  }
  const distanceKm = act.distance ? String((act.distance / 1609.344).toFixed(2)) : undefined;
  const durationMinutes = act.moving_time ? Math.round(act.moving_time / 60) : undefined;
  const activityDate = act.start_date_local
    ? act.start_date_local.substring(0, 10)
    : new Date().toISOString().substring(0, 10);

  const num = (v: number | undefined | null): string | undefined =>
    v === undefined || v === null ? undefined : String(v);
  const intVal = (v: number | undefined | null): number | undefined =>
    v === undefined || v === null ? undefined : Math.round(v);

  const splits = act.splits_standard?.length
    ? act.splits_standard.map((s) => ({
        split: s.split,
        distance: s.distance,
        elapsedTime: s.elapsed_time,
        movingTime: s.moving_time,
        elevationDifference: s.elevation_difference ?? null,
        averageSpeed: s.average_speed,
        averageHeartrate: s.average_heartrate ?? null,
        paceZone: s.pace_zone ?? null,
      }))
    : undefined;

  const bestEfforts = act.best_efforts?.length
    ? act.best_efforts.map((b) => ({
        name: b.name,
        elapsedTime: b.elapsed_time,
        distance: b.distance,
      }))
    : undefined;

  const polyline = (act.map?.summary_polyline ?? act.map?.polyline) || undefined;

  await db.insert(activitiesTable).values({
    userId,
    stravaActivityId: BigInt(stravaActivityId),
    type: activityType,
    ...(distanceKm ? { distanceKm } : {}),
    ...(durationMinutes ? { durationMinutes } : {}),
    ...(act.average_heartrate ? { avgHeartRate: Math.round(act.average_heartrate) } : {}),
    ...(act.name ? { notes: act.name } : {}),
    activityDate,
    ...(act.moving_time ? { movingTimeSeconds: act.moving_time } : {}),
    ...(act.elapsed_time ? { elapsedTimeSeconds: act.elapsed_time } : {}),
    ...(num(act.total_elevation_gain) ? { elevationGainM: num(act.total_elevation_gain) } : {}),
    ...(num(act.elev_high) ? { elevHighM: num(act.elev_high) } : {}),
    ...(num(act.elev_low) ? { elevLowM: num(act.elev_low) } : {}),
    ...(intVal(act.max_heartrate) ? { maxHeartRate: intVal(act.max_heartrate) } : {}),
    ...(num(act.average_cadence) ? { avgCadence: num(act.average_cadence) } : {}),
    ...(num(act.average_speed) ? { avgSpeed: num(act.average_speed) } : {}),
    ...(num(act.max_speed) ? { maxSpeed: num(act.max_speed) } : {}),
    ...(num(act.calories) ? { calories: num(act.calories) } : {}),
    ...(intVal(act.suffer_score) ? { sufferScore: intVal(act.suffer_score) } : {}),
    ...(num(act.average_watts) ? { avgWatts: num(act.average_watts) } : {}),
    ...(intVal(act.average_temp) !== undefined ? { avgTemp: intVal(act.average_temp) } : {}),
    ...(intVal(act.achievement_count) !== undefined ? { achievementCount: intVal(act.achievement_count) } : {}),
    ...(intVal(act.pr_count) !== undefined ? { prCount: intVal(act.pr_count) } : {}),
    ...(intVal(act.kudos_count) !== undefined ? { kudosCount: intVal(act.kudos_count) } : {}),
    ...(intVal(act.comment_count) !== undefined ? { commentCount: intVal(act.comment_count) } : {}),
    ...(intVal(act.athlete_count) !== undefined ? { athleteCount: intVal(act.athlete_count) } : {}),
    ...(act.gear?.name ? { gearName: act.gear.name } : {}),
    ...(act.start_date_local ? { startDateLocal: act.start_date_local } : {}),
    ...(act.timezone ? { timezone: act.timezone } : {}),
    ...(polyline ? { mapPolyline: polyline } : {}),
    ...(act.description ? { description: act.description } : {}),
    ...(act.workout_type !== undefined && act.workout_type !== null ? { workoutType: act.workout_type } : {}),
    ...(splits ? { splits } : {}),
    ...(bestEfforts ? { bestEfforts } : {}),
  });

  await recalculateInjuryRisk(userId).catch(() => undefined);
  logger.info({ userId, stravaActivityId }, "Synced Strava activity");
}

export function getWebhookCallbackUrl(): string {
  // Strava POSTs activity events to this URL. Must be publicly reachable
  // (Netlify in prod proxies /api/strava/webhook → api-server).
  const base = process.env.APP_PUBLIC_URL?.replace(/\/$/, "");
  if (!base) {
    throw new Error("APP_PUBLIC_URL must be set to register a Strava webhook");
  }
  return `${base}/api/strava/webhook`;
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

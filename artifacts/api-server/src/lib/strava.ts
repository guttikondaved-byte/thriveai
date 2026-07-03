import { db, stravaTokensTable, activitiesTable } from "@workspace/db";
import { eq, and, desc, isNotNull, sql } from "drizzle-orm";
import { logger } from "./logger";

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
export type StravaActivityPayload = {
  id?: number;
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

/**
 * Import one Strava activity. When `prefetched` is supplied (a summary payload
 * from the athlete/activities list) it is inserted directly WITHOUT the extra
 * per-activity detail API call — that loses splits/best-efforts/calories but
 * costs zero rate-limit budget, which is what makes full-history backfill
 * feasible under Strava's ~100 reads/15min cap.
 */
export async function syncStravaActivity(
  userId: string,
  stravaActivityId: number,
  prefetched?: StravaActivityPayload,
): Promise<void> {
  // Avoid duplicate imports
  const existing = await db
    .select({ id: activitiesTable.id })
    .from(activitiesTable)
    .where(
      and(
        eq(activitiesTable.userId, userId),
        eq(activitiesTable.stravaActivityId, stravaActivityId),
      ),
    );
  if (existing.length > 0) return;

  let act: StravaActivityPayload;
  if (prefetched) {
    act = prefetched;
  } else {
    const accessToken = await getValidStravaToken(userId);
    if (!accessToken) {
      logger.warn({ userId }, "No valid Strava token for activity sync");
      return;
    }
    const resp = await fetch(`${STRAVA_API_BASE}/activities/${stravaActivityId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) {
      logger.error({ status: resp.status, stravaActivityId }, "Failed to fetch Strava activity");
      return;
    }
    act = (await resp.json()) as StravaActivityPayload;
  }

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
    stravaActivityId: stravaActivityId,
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
    // Summary imports still owe a detail fetch; the backfill job tops them up.
    detailsSynced: !prefetched,
  });

  logger.info({ userId, stravaActivityId }, "Synced Strava activity");
}

/**
 * Gradual detail top-up for summary-only imports.
 *
 * Fetches the full detail payload (splits, best efforts, calories, description)
 * for activities imported without it, newest first, up to `budget` per run —
 * sized to fit inside Strava's ~100 reads/15min window. Every row is marked
 * `detailsSynced` exactly once (including 404s/disconnected users), so no API
 * call is ever spent twice on the same activity. When nothing is pending this
 * costs zero API calls.
 */
export async function backfillStravaDetails(budget = 80): Promise<{ updated: number; pending: number }> {
  const pendingRows = await db
    .select({
      id: activitiesTable.id,
      userId: activitiesTable.userId,
      stravaActivityId: activitiesTable.stravaActivityId,
    })
    .from(activitiesTable)
    .where(and(eq(activitiesTable.detailsSynced, false), isNotNull(activitiesTable.stravaActivityId)))
    .orderBy(desc(activitiesTable.activityDate))
    .limit(budget);

  let updated = 0;
  const tokenByUser = new Map<string, string | null>();

  for (const row of pendingRows) {
    if (!row.userId || !row.stravaActivityId) {
      await db.update(activitiesTable).set({ detailsSynced: true }).where(eq(activitiesTable.id, row.id));
      continue;
    }

    let token = tokenByUser.get(row.userId);
    if (token === undefined) {
      token = await getValidStravaToken(row.userId);
      tokenByUser.set(row.userId, token);
    }
    if (!token) {
      // User disconnected Strava — details are unreachable forever; stop retrying.
      await db.update(activitiesTable).set({ detailsSynced: true }).where(eq(activitiesTable.id, row.id));
      continue;
    }

    const resp = await fetch(`${STRAVA_API_BASE}/activities/${row.stravaActivityId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (resp.status === 429) {
      logger.warn({ updated }, "Strava rate limit hit during detail backfill — stopping until next run");
      break;
    }
    if (!resp.ok) {
      // Gone/private/etc — mark done so we never burn another call on it.
      logger.warn({ status: resp.status, stravaActivityId: row.stravaActivityId }, "Detail backfill fetch failed; marking done");
      await db.update(activitiesTable).set({ detailsSynced: true }).where(eq(activitiesTable.id, row.id));
      continue;
    }

    const act = (await resp.json()) as StravaActivityPayload;
    const num = (v: number | undefined | null): string | undefined =>
      v === undefined || v === null ? undefined : String(v);

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
      ? act.best_efforts.map((b) => ({ name: b.name, elapsedTime: b.elapsed_time, distance: b.distance }))
      : undefined;
    const polyline = (act.map?.polyline ?? act.map?.summary_polyline) || undefined;

    await db
      .update(activitiesTable)
      .set({
        ...(splits ? { splits } : {}),
        ...(bestEfforts ? { bestEfforts } : {}),
        ...(num(act.calories) ? { calories: num(act.calories) } : {}),
        ...(act.description ? { description: act.description } : {}),
        ...(act.gear?.name ? { gearName: act.gear.name } : {}),
        ...(polyline ? { mapPolyline: polyline } : {}),
        detailsSynced: true,
      })
      .where(eq(activitiesTable.id, row.id));
    updated++;
  }

  const [{ pending }] = await db
    .select({ pending: sql<number>`count(*)::int` })
    .from(activitiesTable)
    .where(and(eq(activitiesTable.detailsSynced, false), isNotNull(activitiesTable.stravaActivityId)));

  if (updated > 0 || pending > 0) {
    logger.info({ updated, pending }, "Strava detail backfill run complete");
  }
  return { updated, pending };
}

/**
 * Backfill the athlete's ENTIRE Strava history.
 *
 * Strategy (built around Strava's ~100 reads/15min rate limit):
 * 1. Page through /athlete/activities at 200/page — 1 request per 200
 *    activities, so even years of history costs a handful of calls.
 * 2. The newest `detailBudget` new runs get the full per-activity detail fetch
 *    (splits, best efforts, calories) — these power HR zones + Best Efforts.
 * 3. Everything older is inserted straight from the summary payload (date,
 *    distance, duration, HR, suffer score, elevation…) at zero extra API cost —
 *    exactly what the intensity map, ACWR, and AI context need.
 */
export async function syncStravaFullHistory(
  userId: string,
  detailBudget = 60,
): Promise<{ imported: number; detailed: number; scanned: number } | { error: string }> {
  const accessToken = await getValidStravaToken(userId);
  if (!accessToken) return { error: "Strava not connected" };

  // Every strava id we already have, so re-runs only fetch what's missing.
  const existingRows = await db
    .select({ sid: activitiesTable.stravaActivityId })
    .from(activitiesTable)
    .where(eq(activitiesTable.userId, userId));
  const have = new Set(existingRows.map((r) => r.sid).filter((v): v is number => v != null));

  // Page through the full activity list (newest first).
  const summaries: StravaActivityPayload[] = [];
  for (let page = 1; page <= 20; page++) {
    const resp = await fetch(
      `${STRAVA_API_BASE}/athlete/activities?per_page=200&page=${page}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!resp.ok) {
      logger.error({ status: resp.status, page, userId }, "Strava full-history page fetch failed");
      break;
    }
    const batch = (await resp.json()) as StravaActivityPayload[];
    if (batch.length === 0) break;
    summaries.push(...batch);
    if (batch.length < 200) break;
  }

  const newRuns = summaries.filter(
    (a) => a.id != null && RUN_TYPE_MAP[a.type] && !have.has(a.id),
  );

  let imported = 0;
  let detailed = 0;
  for (let i = 0; i < newRuns.length; i++) {
    const a = newRuns[i];
    try {
      if (i < detailBudget) {
        await syncStravaActivity(userId, a.id!); // full detail fetch
        detailed++;
      } else {
        await syncStravaActivity(userId, a.id!, a); // summary insert, no API call
      }
      imported++;
    } catch (err) {
      logger.error({ err, stravaActivityId: a.id, userId }, "Full-history import failed for activity");
    }
  }

  logger.info({ userId, imported, detailed, scanned: summaries.length }, "Strava full-history sync complete");
  return { imported, detailed, scanned: summaries.length };
}

export function getWebhookCallbackUrl(): string {
  // Strava POSTs activity events to this URL. Must be publicly reachable
  // (Netlify in prod proxies /api/strava/webhook → api-server).
  const explicit = process.env.APP_PUBLIC_URL?.replace(/\/$/, "");
  const base = explicit ?? (process.env.NODE_ENV === "production" ? "https://thriveai.run" : undefined);
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

export async function deleteStravaWebhookSubscription(id: number): Promise<void> {
  const resp = await fetch(
    `${STRAVA_API_BASE}/push_subscriptions/${id}?client_id=${process.env.STRAVA_CLIENT_ID}&client_secret=${process.env.STRAVA_CLIENT_SECRET}`,
    { method: "DELETE" },
  );
  if (!resp.ok && resp.status !== 404) {
    logger.error({ status: resp.status, id }, "Failed to delete stale Strava webhook subscription");
  }
}

import { Activity } from "@workspace/db";

export interface DailyLoad {
  date: string; // YYYY-MM-DD
  day: string; // "Mon" .. "Sun"
  load: number;
  baseline: number;
}

export interface WorkloadRatio {
  daily: DailyLoad[];
  acuteLoad: number;
  chronicWeeklyAvg: number;
  ratio: number | null;
}

export interface IntensityDay {
  date: string;
  day: string;
  intensity: number; // 0 (rest) .. 4 (highest) — used for the heatmap color bucket
  score: number; // 0 (rest) .. 100 (your all-time hardest day) — the displayed intensity score
  activityIds: number[]; // ids of the activities logged on this day (for click-through)
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Session load via the session-RPE method (duration x perceived effort).
 * Falls back to a distance-based estimate when RPE isn't available.
 */
function sessionLoad(activity: Activity): number {
  const rpe = activity.perceivedEffort;
  const duration = activity.durationMinutes;
  if (rpe && duration) return rpe * duration;
  const distanceKm = activity.distanceKm ? Number(activity.distanceKm) : null;
  if (distanceKm) return distanceKm * 10;
  return 0;
}

function isoDateNDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

/** Total session load per calendar date across the given activities. */
function loadByDateMap(activities: Activity[]): Map<string, number> {
  const loadByDate = new Map<string, number>();
  for (const a of activities) {
    if (!a.activityDate) continue;
    loadByDate.set(a.activityDate, (loadByDate.get(a.activityDate) ?? 0) + sessionLoad(a));
  }
  return loadByDate;
}

/** Activity ids logged on each calendar date, so a day can link to its runs. */
function activityIdsByDate(activities: Activity[]): Map<string, number[]> {
  const idsByDate = new Map<string, number[]>();
  for (const a of activities) {
    if (!a.activityDate) continue;
    const ids = idsByDate.get(a.activityDate) ?? [];
    ids.push(a.id);
    idsByDate.set(a.activityDate, ids);
  }
  return idsByDate;
}

/**
 * The single hardest day of training (by session load) across ALL of the given
 * activities. Used as the denominator for the 0-100 intensity score so every
 * day is scored against the athlete's all-time peak, not just the current month.
 */
export function maxDailyLoad(activities: Activity[]): number {
  let max = 0;
  for (const load of loadByDateMap(activities).values()) {
    if (load > max) max = load;
  }
  return max;
}

/**
 * Converts a day's session load into a 0-100 intensity score (relative to the
 * athlete's all-time hardest day) and a 0-4 color bucket for the heatmap.
 * Rest days score 0; any day with load rounds up to at least 1 so it's visible.
 */
function scoreForLoad(load: number, denominator: number): { score: number; intensity: number } {
  if (load <= 0 || denominator <= 0) return { score: 0, intensity: 0 };
  const score = Math.min(100, Math.max(1, Math.round((load / denominator) * 100)));
  const intensity = Math.min(4, Math.max(1, Math.ceil(score / 25)));
  return { score, intensity };
}

/**
 * Computes acute:chronic workload ratio (ACWR) from up to 28 days of activities.
 * Acute load = last 7 days; chronic load = 28-day average per week.
 */
export function computeWorkloadRatio(activities: Activity[]): WorkloadRatio {
  const loadByDate = new Map<string, number>();
  for (const a of activities) {
    if (!a.activityDate) continue;
    loadByDate.set(a.activityDate, (loadByDate.get(a.activityDate) ?? 0) + sessionLoad(a));
  }

  const sevenDaysAgo = isoDateNDaysAgo(6); // inclusive of today = 7 days
  const twentyEightDaysAgo = isoDateNDaysAgo(27);

  let acuteLoad = 0;
  let chronicLoad = 0;
  let earliestChronicDate: string | null = null;
  for (const [date, load] of loadByDate) {
    if (date >= twentyEightDaysAgo) {
      chronicLoad += load;
      if (!earliestChronicDate || date < earliestChronicDate) earliestChronicDate = date;
    }
    if (date >= sevenDaysAgo) acuteLoad += load;
  }

  // Normalize the chronic average by how many weeks of history we ACTUALLY have,
  // not a fixed 4. Otherwise a new athlete (or one just connecting Strava) has
  // empty weeks that deflate the average and inflate the ratio into the danger
  // zone even when they've trained consistently. Also require a minimum baseline
  // (~2 weeks) before reporting a ratio at all.
  const today = new Date().toISOString().split("T")[0];
  let daysOfHistory = 0;
  if (earliestChronicDate) {
    daysOfHistory =
      Math.round(
        (new Date(`${today}T00:00:00`).getTime() - new Date(`${earliestChronicDate}T00:00:00`).getTime()) /
          86_400_000,
      ) + 1;
  }
  const weeksOfHistory = Math.min(4, Math.max(1, daysOfHistory / 7));
  const chronicWeeklyAvg = chronicLoad / weeksOfHistory;
  const hasEnoughHistory = daysOfHistory >= 14;
  const ratio = hasEnoughHistory && chronicWeeklyAvg > 0 ? acuteLoad / chronicWeeklyAvg : null;
  const baseline = chronicWeeklyAvg / 7;

  const daily: DailyLoad[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split("T")[0];
    daily.push({
      date,
      day: DAY_LABELS[d.getDay()],
      load: Math.round((loadByDate.get(date) ?? 0) * 10) / 10,
      baseline: Math.round(baseline * 10) / 10,
    });
  }

  return {
    daily,
    acuteLoad: Math.round(acuteLoad * 10) / 10,
    chronicWeeklyAvg: Math.round(chronicWeeklyAvg * 10) / 10,
    ratio: ratio !== null ? Math.round(ratio * 100) / 100 : null,
  };
}

/**
 * Buckets each of the last N days' session load into a 0-4 intensity level,
 * scaled relative to the highest-load day in the window (for a heatmap view).
 */
export function buildIntensityMap(activities: Activity[], days = 21, allTimeMaxLoad?: number): IntensityDay[] {
  const loadByDate = loadByDateMap(activities);
  const idsByDate = activityIdsByDate(activities);

  const cutoff = isoDateNDaysAgo(days - 1);
  const windowMax = Math.max(
    0,
    ...[...loadByDate.entries()].filter(([date]) => date >= cutoff).map(([, load]) => load),
  );
  const denominator = allTimeMaxLoad && allTimeMaxLoad > 0 ? allTimeMaxLoad : windowMax;

  const result: IntensityDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split("T")[0];
    const load = loadByDate.get(date) ?? 0;
    const { score, intensity } = scoreForLoad(load, denominator);
    result.push({ date, day: DAY_LABELS[d.getDay()], intensity, score, activityIds: idsByDate.get(date) ?? [] });
  }
  return result;
}

/**
 * Intensity map for the CURRENT calendar month: one entry per real day of the
 * month (1st → last), each keyed by its actual date and bucketed 0-4 relative to
 * the hardest day this month. The frontend uses the real dates to lay the days
 * out as a proper calendar (aligned to weekdays), so every square maps to a
 * genuine date and that date's training load.
 *
 * Each day also carries a 0-100 intensity score. When `allTimeMaxLoad` is
 * supplied (the athlete's hardest day across their ENTIRE history), scores are
 * scaled against it so a "78" in April means the same effort as a "78" in
 * January. Without it we fall back to scaling within the month.
 */
export function buildMonthlyIntensityMap(
  activities: Activity[],
  targetYear?: number,
  targetMonth?: number, // 0-11
  allTimeMaxLoad?: number,
): IntensityDay[] {
  const loadByDate = loadByDateMap(activities);
  const idsByDate = activityIdsByDate(activities);

  const now = new Date();
  const year = targetYear ?? now.getFullYear();
  const month = targetMonth ?? now.getMonth(); // 0-11
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

  const monthMax = Math.max(
    0,
    ...[...loadByDate.entries()].filter(([date]) => date.startsWith(monthPrefix)).map(([, load]) => load),
  );
  const denominator = allTimeMaxLoad && allTimeMaxLoad > 0 ? allTimeMaxLoad : monthMax;

  const result: IntensityDay[] = [];
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const d = new Date(year, month, dayNum);
    const date = `${monthPrefix}-${String(dayNum).padStart(2, "0")}`;
    const load = loadByDate.get(date) ?? 0;
    const { score, intensity } = scoreForLoad(load, denominator);
    result.push({ date, day: DAY_LABELS[d.getDay()], intensity, score, activityIds: idsByDate.get(date) ?? [] });
  }
  return result;
}

import { Activity } from "@workspace/db";

export interface WeeklyRelativeEffort {
  total: number;
  band: "low" | "moderate" | "high";
}

export interface ActivityConsistency {
  daysActive: number;
  totalDays: number;
  pct: number;
}

export interface FitnessTrend {
  series: number[];
  changePct: number;
}

export interface HeartRateZone {
  zone: number; // 1..5
  label: string;
  seconds: number;
}

export interface SegmentEffort {
  name: string;
  currentTimeSeconds: number;
  prTimeSeconds: number;
  distanceM: number;
  isPr: boolean;
}

function isoDateNDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

/** Mirrors the session-load model used by workloadRatio so the fitness trend
 * lines up with the workload chart (RPE×duration, else distance-based). */
function sessionLoad(activity: Activity): number {
  const rpe = activity.perceivedEffort;
  const duration = activity.durationMinutes;
  if (rpe && duration) return rpe * duration;
  const distanceKm = activity.distanceKm ? Number(activity.distanceKm) : null;
  if (distanceKm) return distanceKm * 10;
  return 0;
}

/**
 * Weekly Relative Effort = sum of Strava suffer scores over the last 7 days.
 * Bands roughly match Strava's own "low / moderate / high" weekly-load framing.
 */
export function computeWeeklyRelativeEffort(activities: Activity[]): WeeklyRelativeEffort {
  const sevenDaysAgo = isoDateNDaysAgo(6);
  let total = 0;
  for (const a of activities) {
    if (a.activityDate && a.activityDate >= sevenDaysAgo && a.sufferScore) {
      total += a.sufferScore;
    }
  }
  const band = total >= 350 ? "high" : total >= 150 ? "moderate" : "low";
  return { total, band };
}

/** Distinct days with at least one activity in the last 7 days. */
export function computeActivityConsistency(activities: Activity[]): ActivityConsistency {
  const sevenDaysAgo = isoDateNDaysAgo(6);
  const days = new Set<string>();
  for (const a of activities) {
    if (a.activityDate && a.activityDate >= sevenDaysAgo) days.add(a.activityDate);
  }
  const totalDays = 7;
  const daysActive = Math.min(days.size, totalDays);
  return { daysActive, totalDays, pct: Math.round((daysActive / totalDays) * 100) };
}

/**
 * 30-day fitness trend: a 7-day trailing average of daily session load for each
 * of the last 30 days (a lightweight CTL-style proxy). changePct compares the
 * start and end of the window.
 */
export function computeFitnessTrend(activities: Activity[]): FitnessTrend {
  const loadByDate = new Map<string, number>();
  for (const a of activities) {
    if (!a.activityDate) continue;
    loadByDate.set(a.activityDate, (loadByDate.get(a.activityDate) ?? 0) + sessionLoad(a));
  }

  const WINDOW = 30;
  const series: number[] = [];
  for (let i = WINDOW - 1; i >= 0; i--) {
    // 7-day trailing average ending on day (today - i)
    let sum = 0;
    for (let j = 0; j < 7; j++) {
      const d = new Date();
      d.setDate(d.getDate() - i - j);
      sum += loadByDate.get(d.toISOString().split("T")[0]) ?? 0;
    }
    series.push(Math.round((sum / 7) * 10) / 10);
  }

  const first = series.find((v) => v > 0) ?? 0;
  const last = series[series.length - 1] ?? 0;
  const changePct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;

  return { series, changePct };
}

/**
 * Time-in-heart-rate-zone over the last 7 days, derived from per-split average
 * HR weighted by moving time (falling back to whole-activity avg HR when a run
 * has no splits). Zone thresholds are the standard %HRmax model.
 */
export function computeHeartRateZones(activities: Activity[], hrMax: number): HeartRateZone[] {
  const labels = ["Recovery", "Aerobic", "Tempo", "Threshold", "Anaerobic"];
  const seconds = [0, 0, 0, 0, 0];
  const sevenDaysAgo = isoDateNDaysAgo(6);

  const zoneFor = (hr: number): number => {
    const pct = hr / hrMax;
    if (pct < 0.6) return 0;
    if (pct < 0.7) return 1;
    if (pct < 0.8) return 2;
    if (pct < 0.9) return 3;
    return 4;
  };

  for (const a of activities) {
    if (!a.activityDate || a.activityDate < sevenDaysAgo) continue;
    const splits = a.splits ?? [];
    const splitsWithHr = splits.filter((s) => s.averageHeartrate && s.movingTime);
    if (splitsWithHr.length > 0) {
      for (const s of splitsWithHr) {
        seconds[zoneFor(s.averageHeartrate as number)] += s.movingTime;
      }
    } else if (a.avgHeartRate && (a.movingTimeSeconds || a.durationMinutes)) {
      const dur = a.movingTimeSeconds ?? (a.durationMinutes as number) * 60;
      seconds[zoneFor(a.avgHeartRate)] += dur;
    }
  }

  return labels.map((label, i) => ({ zone: i + 1, label, seconds: Math.round(seconds[i]) }));
}

/**
 * Strava "best efforts" (named standard distances) presented as segments:
 * the most recent effort for each named distance vs the athlete's all-time PR.
 */
export function computeSegments(activities: Activity[]): SegmentEffort[] {
  // All-time PR (min elapsed time) per effort name.
  const prByName = new Map<string, number>();
  // Most-recent effort per name (activities arrive newest-first, but guard anyway).
  const currentByName = new Map<string, { time: number; distance: number; date: string }>();

  for (const a of activities) {
    const efforts = a.bestEfforts ?? [];
    for (const e of efforts) {
      if (!e.name || !e.elapsedTime) continue;
      const pr = prByName.get(e.name);
      if (pr === undefined || e.elapsedTime < pr) prByName.set(e.name, e.elapsedTime);

      const date = a.activityDate ?? "";
      const cur = currentByName.get(e.name);
      if (!cur || date > cur.date) {
        currentByName.set(e.name, { time: e.elapsedTime, distance: e.distance, date });
      }
    }
  }

  const segments: SegmentEffort[] = [];
  for (const [name, cur] of currentByName) {
    const prTime = prByName.get(name) ?? cur.time;
    segments.push({
      name,
      currentTimeSeconds: cur.time,
      prTimeSeconds: prTime,
      distanceM: cur.distance,
      isPr: cur.time <= prTime,
    });
  }

  // Shortest distances first (400m, ½ mile, 1k, 1 mile, …) for a stable order.
  segments.sort((a, b) => a.distanceM - b.distanceM);
  return segments.slice(0, 6);
}

/**
 * Training session matching and completion logic
 * Matches activities to training plan sessions based on date, type, and distance
 */

import { Activity, PlanSession } from "@workspace/db";

export interface SessionMatchResult {
  matched: boolean;
  matchScore: number; // 0-100, higher = better match
  sessionId: number;
  activity: Activity;
  matchReasons: string[];
}

export interface CompletionStats {
  weekNumber: number;
  total: number;
  completed: number;
  missed: number;
  percentage: number;
}

/**
 * Check if activity matches a training session
 * Returns match score (0-100) and reasons
 */
export function matchActivityToSession(
  activity: Activity,
  session: PlanSession,
  sessionDate: Date,
): SessionMatchResult {
  let matchScore = 0;
  const matchReasons: string[] = [];
  const activityDate = new Date(activity.activityDate);

  // ── Type matching (40 points) ──
  if (activity.type === session.sessionType) {
    matchScore += 40;
    matchReasons.push(`Type match: ${activity.type} = ${session.sessionType}`);
  } else if (
    (session.sessionType === "cross_training" && 
     ["swim", "bike", "strength", "yoga"].includes(activity.type as string)) ||
    (activity.type === "cross_training" && 
     ["swim", "bike", "strength", "yoga"].includes(session.sessionType as string))
  ) {
    matchScore += 25;
    matchReasons.push(`Flexible type match: ${activity.type} ≈ ${session.sessionType}`);
  }

  // ── Date matching (30 points) ──
  // Exact day is ideal; within 1 day is acceptable
  const daysDiff = Math.abs(Math.floor((activityDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24)));
  if (daysDiff === 0) {
    matchScore += 30;
    matchReasons.push(`Exact date match`);
  } else if (daysDiff === 1) {
    matchScore += 15;
    matchReasons.push(`±1 day match (${daysDiff} day offset)`);
  } else if (daysDiff <= 3) {
    matchScore += 5;
    matchReasons.push(`Within 3 days (${daysDiff} day offset)`);
  }

  // ── Distance matching (20 points) ──
  if (session.distanceKm && activity.distanceKm) {
    const sessionDist = Number(session.distanceKm);
    const activityDist = Number(activity.distanceKm);
    const distDiff = Math.abs(activityDist - sessionDist);
    const distRatio = distDiff / sessionDist;

    if (distRatio <= 0.05) {
      // Within 5% (e.g., 10 km session vs 10.5 km actual)
      matchScore += 20;
      matchReasons.push(
        `Exact distance match: ${activityDist.toFixed(1)} km vs ${sessionDist.toFixed(1)} km planned`,
      );
    } else if (distRatio <= 0.15) {
      // Within 15% (e.g., 10 km session vs 11.5 km actual)
      matchScore += 15;
      matchReasons.push(
        `Distance within 15%: ${activityDist.toFixed(1)} km vs ${sessionDist.toFixed(1)} km planned`,
      );
    } else if (distRatio <= 0.30) {
      // Within 30%
      matchScore += 8;
      matchReasons.push(
        `Distance within 30%: ${activityDist.toFixed(1)} km vs ${sessionDist.toFixed(1)} km planned`,
      );
    }
  } else if (session.distanceKm === null && activity.distanceKm === null) {
    // Both missing distance, but type matched - give partial credit
    if (matchScore >= 25) {
      matchScore += 5;
      matchReasons.push(`No distance data, but type matched`);
    }
  }

  // ── Duration matching (10 points) ──
  if (session.durationMinutes && activity.durationMinutes) {
    const sessionDur = session.durationMinutes;
    const activityDur = activity.durationMinutes;
    const durDiff = Math.abs(activityDur - sessionDur);
    const durRatio = durDiff / sessionDur;

    if (durRatio <= 0.15) {
      // Within 15%
      matchScore += 10;
      matchReasons.push(
        `Duration within 15%: ${activityDur} min vs ${sessionDur} min planned`,
      );
    } else if (durRatio <= 0.30) {
      matchScore += 5;
      matchReasons.push(
        `Duration within 30%: ${activityDur} min vs ${sessionDur} min planned`,
      );
    }
  }

  return {
    matched: matchScore >= 50, // Threshold: >= 50 points = good match
    matchScore: Math.min(matchScore, 100),
    sessionId: session.id,
    activity,
    matchReasons,
  };
}

/**
 * Find best matching session for an activity across multiple sessions
 * Returns the highest-scoring match if it meets threshold
 */
export function findBestSessionMatch(
  activity: Activity,
  sessions: Array<PlanSession & { scheduledDate: Date }>,
  matchThreshold: number = 50,
): SessionMatchResult | null {
  const results = sessions.map((session) =>
    matchActivityToSession(activity, session, session.scheduledDate),
  );

  // Sort by match score descending
  results.sort((a, b) => b.matchScore - a.matchScore);

  // Return best if it meets threshold
  if (results[0] && results[0].matchScore >= matchThreshold) {
    return results[0];
  }

  return null;
}

/**
 * Calculate completion statistics for a training plan week
 */
export function calculateWeeklyCompletion(sessions: PlanSession[]): CompletionStats {
  if (sessions.length === 0) {
    return {
      weekNumber: 0,
      total: 0,
      completed: 0,
      missed: 0,
      percentage: 0,
    };
  }

  const weekNumber = sessions[0]?.weekNumber ?? 0;
  const total = sessions.length;
  const completed = sessions.filter((s) => s.completed).length;
  
  // Missed = past sessions that are not completed
  // (Need plan context to know if session is in past)
  const missed = 0; // Will be calculated per-plan in route handler

  return {
    weekNumber,
    total,
    completed,
    missed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

/**
 * Get all sessions by week with completion stats
 */
export function groupSessionsByWeek(
  sessions: PlanSession[],
): Map<number, { sessions: PlanSession[]; stats: CompletionStats }> {
  const byWeek = new Map<number, PlanSession[]>();

  for (const session of sessions) {
    const week = session.weekNumber;
    if (!byWeek.has(week)) {
      byWeek.set(week, []);
    }
    byWeek.get(week)!.push(session);
  }

  const result = new Map<number, { sessions: PlanSession[]; stats: CompletionStats }>();
  for (const [week, weeklySessions] of byWeek.entries()) {
    result.set(week, {
      sessions: weeklySessions,
      stats: calculateWeeklyCompletion(weeklySessions),
    });
  }

  return result;
}

/**
 * Check if a session is "missed" (past its scheduled date and not completed)
 */
export function isMissedSession(session: PlanSession, scheduledDate: Date, now: Date = new Date()): boolean {
  if (session.completed) return false; // Completed sessions are not missed
  return scheduledDate < now; // Past date = missed
}

/**
 * Calculate training load for a plan based on weekly distance progression
 */
export function calculatePlanTrainingLoad(sessions: PlanSession[]): {
  totalDistanceKm: number;
  avgWeeklyDistanceKm: number;
  longRunDistanceKm: number | null;
  speedWorkCount: number;
} {
  const totalDistance = sessions.reduce((sum, s) => sum + Number(s.distanceKm ?? 0), 0);
  const uniqueWeeks = new Set(sessions.map((s) => s.weekNumber)).size;
  const longRun = sessions
    .filter((s) => s.sessionType === "long_run")
    .reduce((max, s) => Math.max(max, Number(s.distanceKm ?? 0)), 0);

  const speedWork = sessions.filter(
    (s) => ["tempo_run", "interval", "race"].includes(s.sessionType),
  ).length;

  return {
    totalDistanceKm: Math.round(totalDistance * 10) / 10,
    avgWeeklyDistanceKm: uniqueWeeks > 0 ? Math.round((totalDistance / uniqueWeeks) * 10) / 10 : 0,
    longRunDistanceKm: longRun > 0 ? Math.round(longRun * 10) / 10 : null,
    speedWorkCount: speedWork,
  };
}

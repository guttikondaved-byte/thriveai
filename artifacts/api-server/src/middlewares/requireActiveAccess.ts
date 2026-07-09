import type { NextFunction, Request, Response } from "express";
import { hasActiveAccess } from "../lib/access";

/**
 * The app has a free tier: athletes get full access (dashboard, activities,
 * training plans, injury-risk, AveraAI, Strava) with no subscription at all —
 * AveraAI's monthly message count and Strava's auto-sync are capped for free
 * accounts at their own route handlers (see openai.ts and strava.ts), not
 * blocked here.
 *
 * The one thing still gated behind an active subscription is a COACH's team
 * management — creating/deleting a team, viewing the roster, regenerating the
 * invite code, broadcasting, and viewing an athlete's data as a coach. That's
 * the coach's paid tier ("25 athletes included, then $4/athlete"), unrelated
 * to the athlete free tier above. An athlete joining/leaving/checking their
 * own team status is always free, since that's what grants them coverage
 * under their coach's plan in the first place.
 *
 * Matched against req.path, which is already relative to the /api mount.
 */
const FREE_TEAM_EXACT = new Set<string>(["/teams/my", "/teams/join", "/teams/leave"]);
const FREE_TEAM_PREFIXES = ["/teams/invite/"];

function requiresCoachSubscription(path: string): boolean {
  if (!path.startsWith("/teams")) return false;
  if (FREE_TEAM_EXACT.has(path)) return false;
  return !FREE_TEAM_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * Backend enforcement of the coach-team paywall. Only acts on authenticated
 * requests to a coach-gated path — everything else (the athlete free tier)
 * passes through untouched. This mirrors (and backstops) the frontend gate in
 * App.tsx, which is what coaches actually see, but nothing previously stopped
 * a request made directly against the API (curl, a stale session) from
 * reading/writing team data after a coach's subscription lapsed.
 */
export async function requireActiveAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.isAuthenticated() || !requiresCoachSubscription(req.path)) {
    next();
    return;
  }

  try {
    if (await hasActiveAccess(req.user.id)) {
      next();
      return;
    }
    res.status(402).json({
      error: "An active coach subscription is required to manage a team.",
      code: "subscription_required",
    });
  } catch (err) {
    req.log?.error({ err }, "Failed to check subscription access");
    // Fail open — a transient DB error shouldn't lock out paying users, same
    // policy as the frontend gate.
    next();
  }
}

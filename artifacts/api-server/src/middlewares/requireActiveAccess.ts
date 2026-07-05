import type { NextFunction, Request, Response } from "express";
import { hasActiveAccess } from "../lib/access";

/**
 * Paths exempt from the subscription gate — anything needed to sign in, learn
 * your own role/status, pay, or join a team (which is what grants coverage in
 * the first place). Everything else requires an active trial/subscription
 * (or, for team athletes, an active coach). Matched against req.path, which
 * is already relative to the /api mount.
 *
 * This mirrors (and backstops) the frontend gate in App.tsx — that gate is
 * what users actually see, but nothing previously stopped a request made
 * directly against the API (curl, an expired session left open, etc.) from
 * reading/writing paid data after a trial lapsed.
 */
const EXEMPT_EXACT = new Set<string>([
  "/healthz",
  "/athlete/profile", // role + profile, needed before a subscription exists
  "/auth/user",
  "/auth/register",
  "/auth/login",
  "/login",
  "/callback",
  "/logout",
  "/mobile-auth/logout",
  "/account", // let users delete their account regardless of billing state
  "/teams/my", // team status check, used throughout onboarding/gate transitions
  "/teams/join", // joining is how team-covered athletes gain access
  "/teams/leave", // don't trap someone in a lapsed team they want to leave
]);

const EXEMPT_PREFIXES = ["/stripe/", "/teams/invite/"];

function isExempt(path: string): boolean {
  if (EXEMPT_EXACT.has(path)) return true;
  return EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * Backend enforcement of the paywall/trial. Only acts on authenticated
 * requests — unauthenticated requests fall through so each route's own
 * `isAuthenticated()` check returns its usual 401.
 */
export async function requireActiveAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.isAuthenticated() || isExempt(req.path)) {
    next();
    return;
  }

  try {
    if (await hasActiveAccess(req.user.id)) {
      next();
      return;
    }
    res.status(402).json({
      error: "An active subscription is required to use this feature.",
      code: "subscription_required",
    });
  } catch (err) {
    req.log?.error({ err }, "Failed to check subscription access");
    // Fail open — a transient DB error shouldn't lock out paying users, same
    // policy as the frontend gate.
    next();
  }
}

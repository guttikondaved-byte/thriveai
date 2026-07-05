import { eq } from "drizzle-orm";
import { db, athleteProfileTable, teamsTable, teamMembershipsTable } from "@workspace/db";

// Statuses that grant access to the app. `trialing` covers the free trial and
// `comp` is a legacy permanent grant. Access is also gated on the period end
// (see isAccessActive) so a free trial actually expires.
const ACTIVE_STATUSES = new Set(["trialing", "active", "past_due", "comp"]);

export function isActiveStatus(status: string | null | undefined): boolean {
  return !!status && ACTIVE_STATUSES.has(status);
}

/**
 * Whether the stored subscription grants access right now. Active status AND
 * not past its period end (a null period end = never expires, e.g. comp).
 */
export function isAccessActive(
  status: string | null | undefined,
  periodEnd: Date | null | undefined,
): boolean {
  if (!isActiveStatus(status)) return false;
  if (!periodEnd) return true;
  return periodEnd.getTime() > Date.now();
}

/**
 * Whether the user is an athlete on a team whose coach currently has active
 * access. Team athletes are covered by their coach's plan (free up to 25,
 * then the coach pays per extra athlete) — but only while the coach is
 * actually paying/trialing. If the coach's own trial or subscription lapses,
 * coverage lapses too, so this can't be used as a way to dodge billing
 * indefinitely by having any coach (even one who never converts) invite you.
 */
export async function isCoveredByTeam(userId: string): Promise<boolean> {
  const memberships = await db
    .select({
      coachStatus: athleteProfileTable.subscriptionStatus,
      coachPeriodEnd: athleteProfileTable.subscriptionCurrentPeriodEnd,
    })
    .from(teamMembershipsTable)
    .innerJoin(teamsTable, eq(teamsTable.id, teamMembershipsTable.teamId))
    .innerJoin(athleteProfileTable, eq(athleteProfileTable.userId, teamsTable.coachUserId))
    .where(eq(teamMembershipsTable.athleteUserId, userId));

  return memberships.some((m) => isAccessActive(m.coachStatus, m.coachPeriodEnd));
}

/**
 * Whether this user currently has access to the paid app — either their own
 * active trial/subscription, or coverage via an active coach's team. This is
 * the single source of truth used by both the /stripe/subscription status
 * endpoint and the backend access-gate middleware, so the two can never
 * disagree about who's allowed in.
 */
export async function hasActiveAccess(userId: string): Promise<boolean> {
  const [profile] = await db
    .select({
      status: athleteProfileTable.subscriptionStatus,
      currentPeriodEnd: athleteProfileTable.subscriptionCurrentPeriodEnd,
    })
    .from(athleteProfileTable)
    .where(eq(athleteProfileTable.userId, userId))
    .limit(1);

  if (isAccessActive(profile?.status, profile?.currentPeriodEnd)) return true;
  return isCoveredByTeam(userId);
}

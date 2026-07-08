import { eq, and, gte, inArray } from "drizzle-orm";
import {
  db,
  teamsTable,
  teamMembershipsTable,
  teamCoachesTable,
  usersTable,
  activitiesTable,
  injuryAlertsTable,
  weeklyDigestLogTable,
} from "@workspace/db";
import { sendWeeklyDigestEmail } from "./email";
import { logger } from "./logger";

/** ISO date (YYYY-MM-DD) of the Monday on/before today. */
export function currentWeekMondayISO(now = new Date()): string {
  const day = now.getDay(); // 0 = Sun .. 6 = Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  return monday.toISOString().slice(0, 10);
}

function fullName(u: { firstName: string | null; lastName: string | null }, fallback: string): string {
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
  return name || fallback;
}

/**
 * Sends the weekly team-workload digest to every team's coach(es), skipping
 * teams that already got one for this week (via weeklyDigestLogTable) or
 * that have no athletes yet. Intended to be triggered once a week (see
 * index.ts) — safe to call more than once since it's idempotent per team/week.
 */
export async function sendWeeklyCoachDigests(): Promise<void> {
  const weekOf = currentWeekMondayISO();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const sevenDaysAgoDate = sevenDaysAgo.toISOString().slice(0, 10);

  const teams = await db.select().from(teamsTable);

  for (const team of teams) {
    try {
      const [alreadySent] = await db
        .select()
        .from(weeklyDigestLogTable)
        .where(and(eq(weeklyDigestLogTable.teamId, team.id), eq(weeklyDigestLogTable.weekOf, weekOf)))
        .limit(1);
      if (alreadySent) continue;

      const memberships = await db
        .select({ athleteUserId: teamMembershipsTable.athleteUserId })
        .from(teamMembershipsTable)
        .where(eq(teamMembershipsTable.teamId, team.id));
      if (memberships.length === 0) continue;

      const memberIds = memberships.map((m) => m.athleteUserId);

      const activities = await db
        .select({ userId: activitiesTable.userId, distanceKm: activitiesTable.distanceKm })
        .from(activitiesTable)
        .where(and(inArray(activitiesTable.userId, memberIds), gte(activitiesTable.activityDate, sevenDaysAgoDate)));
      const totalKm = Math.round(activities.reduce((sum, a) => sum + (a.distanceKm ? Number(a.distanceKm) : 0), 0));

      const newAlerts = await db
        .select({ userId: injuryAlertsTable.userId, riskLevel: injuryAlertsTable.riskLevel, bodyPart: injuryAlertsTable.bodyPart })
        .from(injuryAlertsTable)
        .where(and(inArray(injuryAlertsTable.userId, memberIds), gte(injuryAlertsTable.createdAt, sevenDaysAgo)));

      const athleteUsers = await db
        .select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName })
        .from(usersTable)
        .where(inArray(usersTable.id, memberIds));
      const athleteNameById = new Map(athleteUsers.map((u) => [u.id, fullName(u, "An athlete")]));

      const newAlertSummaries = newAlerts.map(
        (a) => `${athleteNameById.get(a.userId ?? "") ?? "An athlete"} — ${a.bodyPart} (${a.riskLevel} risk)`,
      );

      const coachUserIds = new Set<string>([team.coachUserId]);
      const coCoaches = await db.select({ coachUserId: teamCoachesTable.coachUserId }).from(teamCoachesTable).where(eq(teamCoachesTable.teamId, team.id));
      for (const c of coCoaches) coachUserIds.add(c.coachUserId);

      const coaches = await db
        .select({ id: usersTable.id, email: usersTable.email, firstName: usersTable.firstName, lastName: usersTable.lastName })
        .from(usersTable)
        .where(inArray(usersTable.id, Array.from(coachUserIds)));

      for (const coach of coaches) {
        if (!coach.email) continue;
        await sendWeeklyDigestEmail({
          to: coach.email,
          recipientName: fullName(coach, "Coach"),
          teamName: team.name,
          weekOf,
          athleteCount: memberIds.length,
          totalKm,
          newAlertSummaries,
        });
      }

      // Insert last, after emails go out: if this crashes or races, we'd
      // rather risk a duplicate send (caught next run before insert succeeds
      // again — the unique constraint blocks a true double-insert) than
      // silently mark a week "sent" when the emails never went.
      await db.insert(weeklyDigestLogTable).values({ teamId: team.id, weekOf }).onConflictDoNothing();
    } catch (err) {
      logger.error({ err, teamId: team.id }, "Failed to send weekly digest for team");
    }
  }
}

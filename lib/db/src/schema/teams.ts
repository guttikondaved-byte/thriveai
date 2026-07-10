import { pgTable, text, serial, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  coachUserId: text("coach_user_id").notNull().references(() => usersTable.id),
  inviteCode: text("invite_code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teamMembershipsTable = pgTable("team_memberships", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  athleteUserId: text("athlete_user_id").notNull().references(() => usersTable.id),
  status: text("status").notNull().default("active"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

// Additional coaches on a team, beyond the primary teams.coachUserId. Joined via
// the same invite-code flow athletes use — if the joining account is a coach,
// they become a co-coach instead of an athlete member. Co-coaches get full
// operational access (roster, plans, AveraAI) but can't delete the team or
// regenerate its invite code — those stay primary-coach-only.
export const teamCoachesTable = pgTable("team_coaches", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  coachUserId: text("coach_user_id").notNull().references(() => usersTable.id),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per team per week a digest email was sent. The unique constraint on
// (teamId, weekOf) is what actually prevents duplicate sends — the sender
// logic checks it before sending, but concurrent runs or retries could race,
// so the constraint is the real guarantee, not just the check.
export const weeklyDigestLogTable = pgTable("weekly_digest_log", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  weekOf: text("week_of").notNull(), // ISO date (YYYY-MM-DD) of that week's Monday
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.teamId, t.weekOf)]);

// Same idempotency pattern as weeklyDigestLogTable, but for the Pro-only
// personal athlete digest (one row per athlete per week) rather than a team.
export const athleteDigestLogTable = pgTable("athlete_digest_log", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  weekOf: text("week_of").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.userId, t.weekOf)]);

export type Team = typeof teamsTable.$inferSelect;
export type TeamMembership = typeof teamMembershipsTable.$inferSelect;
export type TeamCoach = typeof teamCoachesTable.$inferSelect;
export type WeeklyDigestLog = typeof weeklyDigestLogTable.$inferSelect;
export type AthleteDigestLog = typeof athleteDigestLogTable.$inferSelect;

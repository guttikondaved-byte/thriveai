import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("General Running"), // Track, Cross Country, Marathon, General Running, etc.
  coachUserId: text("coach_user_id").notNull().references(() => usersTable.id),
  inviteCode: text("invite_code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const teamMembershipsTable = pgTable("team_memberships", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  athleteUserId: text("athlete_user_id").notNull().references(() => usersTable.id),
  status: text("status").notNull().default("active"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const coachProfileTable = pgTable("coach_profile", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => usersTable.id),
  bio: text("bio"),
  certifications: text("certifications"), // JSON array: [{title, issuer, year}, ...]
  experience: integer("experience"), // years of coaching experience
  specialties: text("specialties"), // JSON array: ["Track", "Marathon", "Trail", ...]
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Team = typeof teamsTable.$inferSelect;
export type TeamMembership = typeof teamMembershipsTable.$inferSelect;
export type CoachProfile = typeof coachProfileTable.$inferSelect;

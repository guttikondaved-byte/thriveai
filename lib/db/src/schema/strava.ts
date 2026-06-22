import { pgTable, text, serial, integer, timestamp, bigint } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const stravaTokensTable = pgTable("strava_tokens", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => usersTable.id),
  stravaAthleteId: bigint("strava_athlete_id", { mode: "number" }).notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: integer("expires_at").notNull(),
  scope: text("scope"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type StravaToken = typeof stravaTokensTable.$inferSelect;

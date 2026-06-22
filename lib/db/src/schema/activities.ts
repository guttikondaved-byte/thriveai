import { pgTable, text, serial, integer, numeric, timestamp, date, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const activitiesTable = pgTable("activities", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => usersTable.id),
  stravaActivityId: bigint("strava_activity_id", { mode: "number" }),
  type: text("type").notNull(),
  distanceKm: numeric("distance_km", { precision: 8, scale: 2 }),
  durationMinutes: integer("duration_minutes"),
  avgHeartRate: integer("avg_heart_rate"),
  perceivedEffort: integer("perceived_effort"),
  notes: text("notes"),
  activityDate: date("activity_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activitiesTable).omit({ id: true, createdAt: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activitiesTable.$inferSelect;

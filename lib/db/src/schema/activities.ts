import { pgTable, text, serial, integer, numeric, timestamp, date, bigint, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export type ActivitySplit = {
  split: number;
  distance: number; // meters
  elapsedTime: number; // seconds
  movingTime: number; // seconds
  elevationDifference: number | null; // meters
  averageSpeed: number; // m/s
  averageHeartrate: number | null; // bpm
  paceZone: number | null;
};

export type ActivityBestEffort = {
  name: string;
  elapsedTime: number; // seconds
  distance: number; // meters
};

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

  // ── Rich Strava activity detail ──
  movingTimeSeconds: integer("moving_time_seconds"),
  elapsedTimeSeconds: integer("elapsed_time_seconds"),
  elevationGainM: numeric("elevation_gain_m", { precision: 8, scale: 1 }),
  elevHighM: numeric("elev_high_m", { precision: 8, scale: 1 }),
  elevLowM: numeric("elev_low_m", { precision: 8, scale: 1 }),
  maxHeartRate: integer("max_heart_rate"),
  avgCadence: numeric("avg_cadence", { precision: 5, scale: 1 }), // Strava per-leg cadence
  avgSpeed: numeric("avg_speed", { precision: 6, scale: 3 }), // m/s
  maxSpeed: numeric("max_speed", { precision: 6, scale: 3 }), // m/s
  calories: numeric("calories", { precision: 8, scale: 1 }),
  sufferScore: integer("suffer_score"), // Strava "Relative Effort"
  avgWatts: numeric("avg_watts", { precision: 7, scale: 1 }),
  avgTemp: integer("avg_temp"), // °C
  achievementCount: integer("achievement_count"),
  prCount: integer("pr_count"),
  kudosCount: integer("kudos_count"),
  commentCount: integer("comment_count"),
  athleteCount: integer("athlete_count"),
  gearName: text("gear_name"),
  startDateLocal: text("start_date_local"), // ISO local wall-clock
  timezone: text("timezone"),
  mapPolyline: text("map_polyline"), // Google-encoded summary polyline
  description: text("description"),
  workoutType: integer("workout_type"),
  splits: jsonb("splits").$type<ActivitySplit[]>(),
  bestEfforts: jsonb("best_efforts").$type<ActivityBestEffort[]>(),
  // True once the full Strava detail payload (splits, best efforts, calories)
  // has been fetched for this activity. Summary-only imports start false and
  // are topped up by the gradual detail-backfill job without re-fetching
  // anything twice.
  detailsSynced: boolean("details_synced").notNull().default(false),
});

export const insertActivitySchema = createInsertSchema(activitiesTable).omit({ id: true, createdAt: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activitiesTable.$inferSelect;

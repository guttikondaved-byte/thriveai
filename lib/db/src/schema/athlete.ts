import { pgTable, text, serial, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const athleteProfileTable = pgTable("athlete_profile", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("Athlete"),
  age: integer("age"),
  weeklyMileageGoal: numeric("weekly_mileage_goal", { precision: 6, scale: 2 }),
  fitnessLevel: text("fitness_level").notNull().default("intermediate"),
  primaryGoal: text("primary_goal").notNull().default("Stay fit"),
  restingHeartRate: integer("resting_heart_rate"),
  hrv: numeric("hrv", { precision: 6, scale: 2 }),
  selectedCoach: text("selected_coach"),
  userRole: text("user_role"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAthleteProfileSchema = createInsertSchema(athleteProfileTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAthleteProfile = z.infer<typeof insertAthleteProfileSchema>;
export type AthleteProfile = typeof athleteProfileTable.$inferSelect;

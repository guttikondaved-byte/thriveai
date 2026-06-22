import { pgTable, text, serial, integer, numeric, timestamp, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const trainingPlansTable = pgTable("training_plans", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => usersTable.id),
  name: text("name").notNull(),
  goal: text("goal").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  weeklyMileage: numeric("weekly_mileage", { precision: 6, scale: 2 }),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const planSessionsTable = pgTable("plan_sessions", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => trainingPlansTable.id, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  sessionType: text("session_type").notNull(),
  description: text("description").notNull(),
  distanceKm: numeric("distance_km", { precision: 6, scale: 2 }),
  durationMinutes: integer("duration_minutes"),
  completed: boolean("completed").notNull().default(false),
});

export const insertTrainingPlanSchema = createInsertSchema(trainingPlansTable).omit({ id: true, createdAt: true });
export const insertPlanSessionSchema = createInsertSchema(planSessionsTable).omit({ id: true });
export type InsertTrainingPlan = z.infer<typeof insertTrainingPlanSchema>;
export type TrainingPlan = typeof trainingPlansTable.$inferSelect;
export type PlanSession = typeof planSessionsTable.$inferSelect;

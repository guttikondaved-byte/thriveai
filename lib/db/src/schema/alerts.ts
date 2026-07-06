import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const injuryAlertsTable = pgTable("injury_alerts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => usersTable.id),
  riskLevel: text("risk_level").notNull(),
  bodyPart: text("body_part").notNull(),
  message: text("message").notNull(),
  recommendation: text("recommendation").notNull(),
  acknowledged: boolean("acknowledged").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInjuryAlertSchema = createInsertSchema(injuryAlertsTable).omit({ id: true, createdAt: true });
export type InsertInjuryAlert = z.infer<typeof insertInjuryAlertSchema>;
export type InjuryAlert = typeof injuryAlertsTable.$inferSelect;

export const injuryAlertCommentsTable = pgTable("injury_alert_comments", {
  id: serial("id").primaryKey(),
  alertId: integer("alert_id").notNull().references(() => injuryAlertsTable.id),
  coachUserId: text("coach_user_id").notNull().references(() => usersTable.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInjuryAlertCommentSchema = createInsertSchema(injuryAlertCommentsTable).omit({ id: true, createdAt: true });
export type InsertInjuryAlertComment = z.infer<typeof insertInjuryAlertCommentSchema>;
export type InjuryAlertComment = typeof injuryAlertCommentsTable.$inferSelect;

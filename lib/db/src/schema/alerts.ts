import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const injuryAlertsTable = pgTable("injury_alerts", {
  id: serial("id").primaryKey(),
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

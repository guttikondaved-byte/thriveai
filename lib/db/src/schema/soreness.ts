import { pgTable, serial, text, integer, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const sorenessLogsTable = pgTable("soreness_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => usersTable.id),
  bodyPart: text("body_part").notNull(),
  painScore: integer("pain_score").notNull(),
  loggedDate: date("logged_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSorenessLogSchema = createInsertSchema(sorenessLogsTable).omit({ id: true, createdAt: true });
export type InsertSorenessLog = z.infer<typeof insertSorenessLogSchema>;
export type SorenessLog = typeof sorenessLogsTable.$inferSelect;

import { pgTable, serial, text, integer, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { athleteProfileTable } from "./athlete";

export const injuriesTable = pgTable("injuries", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => athleteProfileTable.id, { onDelete: "cascade" }),
  injuryType: text("injury_type").notNull(),
  bodyPart: text("body_part").notNull(),
  dateOccurred: date("date_occurred", { mode: "string" }).notNull(),
  dateRecovered: date("date_recovered", { mode: "string" }),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInjurySchema = createInsertSchema(injuriesTable).omit({ id: true, createdAt: true });
export type InsertInjury = z.infer<typeof insertInjurySchema>;
export type Injury = typeof injuriesTable.$inferSelect;

import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

// A direct 1:1 thread between a coach and one athlete on their team — distinct
// from injury_alert_comments (scoped to a specific alert) and the AveraAI
// `messages` table (chat with the AI, not with a person).
export const directMessagesTable = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  athleteUserId: text("athlete_user_id").notNull().references(() => usersTable.id),
  authorUserId: text("author_user_id").notNull().references(() => usersTable.id),
  authorRole: text("author_role").notNull(), // 'coach' | 'athlete'
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDirectMessageSchema = createInsertSchema(directMessagesTable).omit({ id: true, createdAt: true });
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
export type DirectMessage = typeof directMessagesTable.$inferSelect;

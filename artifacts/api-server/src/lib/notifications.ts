import { db, notificationsTable } from "@workspace/db";

type NotificationType = "risk" | "info" | "warning" | "update";

export async function createNotification(userId: string, title: string, message: string, type: NotificationType = "risk") {
  await db.insert(notificationsTable).values({
    userId,
    type,
    title,
    message,
  });
}

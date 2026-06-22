import { getAuth, clerkClient } from "@clerk/express";
import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;
      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

/**
 * Migrate an old account (UUID id) to a Clerk user ID.
 * Strategy: create new user row with Clerk ID, reparent all child rows,
 * then delete the old row. This avoids FK chicken-and-egg problems.
 */
async function migrateUserToClerkId(
  oldId: string,
  clerkUserId: string,
  email: string | null,
  firstName: string | null,
  lastName: string | null,
  profileImageUrl: string | null,
) {
  await db.transaction(async (tx) => {
    const tempEmail = `migrated_${oldId}@placeholder.local`;
    // 1. Free the email on the old row so we can insert the new one
    await tx.execute(sql`UPDATE users SET email = ${tempEmail} WHERE id = ${oldId}`);
    // 2. Insert the new user row with Clerk ID (email is now unique)
    await tx.execute(sql`
      INSERT INTO users (id, email, first_name, last_name, profile_image_url, created_at, updated_at)
      VALUES (${clerkUserId}, ${email}, ${firstName}, ${lastName}, ${profileImageUrl}, NOW(), NOW())
    `);
    // 3. Reparent all child tables (FK now valid because clerkUserId exists in users)
    await tx.execute(sql`UPDATE athlete_profile SET user_id = ${clerkUserId} WHERE user_id = ${oldId}`);
    await tx.execute(sql`UPDATE teams SET coach_user_id = ${clerkUserId} WHERE coach_user_id = ${oldId}`);
    await tx.execute(sql`UPDATE team_memberships SET athlete_user_id = ${clerkUserId} WHERE athlete_user_id = ${oldId}`);
    await tx.execute(sql`UPDATE notifications SET user_id = ${clerkUserId} WHERE user_id = ${oldId}`);
    await tx.execute(sql`UPDATE strava_tokens SET user_id = ${clerkUserId} WHERE user_id = ${oldId}`);
    await tx.execute(sql`UPDATE activities SET user_id = ${clerkUserId} WHERE user_id = ${oldId}`);
    await tx.execute(sql`UPDATE injury_alerts SET user_id = ${clerkUserId} WHERE user_id = ${oldId}`);
    await tx.execute(sql`UPDATE training_plans SET user_id = ${clerkUserId} WHERE user_id = ${oldId}`);
    await tx.execute(sql`UPDATE conversations SET user_id = ${clerkUserId} WHERE user_id = ${oldId}`);
    // 4. Safe to delete old row — nothing references it any more
    await tx.execute(sql`DELETE FROM users WHERE id = ${oldId}`);
  });
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const auth = getAuth(req);
  const clerkUserId = auth?.userId;

  if (!clerkUserId) {
    next();
    return;
  }

  // Fast path: user already provisioned under this Clerk ID
  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, clerkUserId))
    .limit(1);

  if (existingUser) {
    req.user = {
      id: existingUser.id,
      email: existingUser.email,
      firstName: existingUser.firstName,
      lastName: existingUser.lastName,
      profileImageUrl: existingUser.profileImageUrl,
    };
    next();
    return;
  }

  // Slow path: fetch from Clerk and JIT-provision
  try {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? null;
    const firstName = clerkUser.firstName ?? null;
    const lastName = clerkUser.lastName ?? null;
    const profileImageUrl = clerkUser.imageUrl ?? null;

    let newUser: typeof usersTable.$inferSelect | undefined;

    try {
      [newUser] = await db
        .insert(usersTable)
        .values({ id: clerkUserId, email, firstName, lastName, profileImageUrl })
        .onConflictDoUpdate({
          target: usersTable.id,
          set: { email, firstName, lastName, profileImageUrl, updatedAt: new Date() },
        })
        .returning();
    } catch (insertErr: unknown) {
      const msg = insertErr instanceof Error ? insertErr.message : String(insertErr);

      if (msg.includes("users_email_unique") && email) {
        // A pre-Clerk account with this email exists under a different ID.
        // Find the old account and migrate it to the Clerk user ID.
        const [oldUser] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, email))
          .limit(1);

        if (oldUser && oldUser.id !== clerkUserId) {
          req.log?.info({ oldId: oldUser.id, clerkUserId }, "Migrating pre-Clerk account to Clerk ID");
          await migrateUserToClerkId(oldUser.id, clerkUserId, email, firstName, lastName, profileImageUrl);
          [newUser] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.id, clerkUserId))
            .limit(1);
        }
      } else {
        throw insertErr;
      }
    }

    if (newUser) {
      req.user = {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        profileImageUrl: newUser.profileImageUrl,
      };
    }
  } catch (err) {
    req.log?.error({ err }, "Failed to JIT-provision Clerk user");
  }

  next();
}

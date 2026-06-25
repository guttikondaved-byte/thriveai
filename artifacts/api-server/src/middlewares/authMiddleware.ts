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
 * Detect a Postgres unique-violation on the users.email constraint.
 *
 * drizzle's DrizzleQueryError only puts the failed SQL + params in `.message`;
 * the actual Postgres error (constraint name, error code 23505) lives on the
 * `.cause` chain. We must walk that chain — checking `.message` alone misses it
 * and the email-migration recovery path silently never runs.
 */
function isEmailUniqueViolation(err: unknown): boolean {
  let cur: unknown = err;
  for (let depth = 0; cur != null && depth < 6; depth++) {
    if (typeof cur === "object") {
      const e = cur as { message?: unknown; code?: unknown; constraint?: unknown; cause?: unknown };
      if (typeof e.message === "string" && e.message.includes("users_email_unique")) return true;
      if (e.code === "23505" && e.constraint === "users_email_unique") return true;
      if (typeof e.constraint === "string" && e.constraint === "users_email_unique") return true;
      cur = e.cause;
    } else {
      if (typeof cur === "string" && cur.includes("users_email_unique")) return true;
      break;
    }
  }
  return false;
}

function isClerkNotFound(err: unknown): boolean {
  const e = err as { status?: unknown; statusCode?: unknown } | null;
  return !!e && (e.status === 404 || e.statusCode === 404);
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
    // 0. Serialize concurrent migrations for the same email. On login the client
    //    fires many requests at once; without this lock they all race to migrate
    //    the same account and every transaction conflicts and rolls back.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${email ?? oldId}))`);

    // Re-check inside the lock: another request may have already completed the
    // migration while we were waiting. If so, there is nothing left to do.
    const alreadyMigrated = await tx.execute(
      sql`SELECT 1 FROM users WHERE id = ${clerkUserId}`,
    );
    if (alreadyMigrated.rows.length > 0) return;

    const tempEmail = `migrated_${oldId}@placeholder.local`;
    // 1. Free the email on the old row so we can insert the new one
    await tx.execute(sql`UPDATE users SET email = ${tempEmail} WHERE id = ${oldId}`);
    // 2. Insert the new user row with Clerk ID (email is now unique)
    await tx.execute(sql`
      INSERT INTO users (id, email, first_name, last_name, profile_image_url, created_at, updated_at)
      VALUES (${clerkUserId}, ${email}, ${firstName}, ${lastName}, ${profileImageUrl}, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
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
  let existingUser: typeof usersTable.$inferSelect | undefined;
  try {
    [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, clerkUserId))
      .limit(1);
  } catch (err) {
    const cause = (err as { cause?: unknown })?.cause;
    console.error("[authMiddleware] fast-path DB error:", err);
    console.error("[authMiddleware] cause:", cause);
    res.status(500).json({ error: "Database error" });
    return;
  }

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
      if (isEmailUniqueViolation(insertErr) && email) {
        // A pre-Clerk account with this email exists under a different ID.
        // Find the old account and migrate it to the Clerk user ID if it still
        // exists in Clerk. If the old Clerk user was already deleted, free the
        // email on the stale row so a new account can be provisioned.
        const [oldUser] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, email))
          .limit(1);

        if (oldUser && oldUser.id !== clerkUserId) {
          let oldUserExists = true;
          try {
            await clerkClient.users.getUser(oldUser.id);
          } catch (err) {
            if (isClerkNotFound(err)) {
              oldUserExists = false;
            } else {
              throw err;
            }
          }

          if (oldUserExists) {
            req.log?.info({ oldId: oldUser.id, clerkUserId }, "Migrating pre-Clerk account to Clerk ID");
            await migrateUserToClerkId(oldUser.id, clerkUserId, email, firstName, lastName, profileImageUrl);
          } else {
            req.log?.info({ oldId: oldUser.id, clerkUserId }, "Clearing stale deleted user email to allow new Clerk account");
            const tempEmail = `deleted_${oldUser.id}@placeholder.local`;
            await db
              .update(usersTable)
              .set({ email: tempEmail })
              .where(eq(usersTable.id, oldUser.id));
            [newUser] = await db
              .insert(usersTable)
              .values({ id: clerkUserId, email, firstName, lastName, profileImageUrl })
              .returning();
          }

          if (!newUser) {
            [newUser] = await db
              .select()
              .from(usersTable)
              .where(eq(usersTable.id, clerkUserId))
              .limit(1);
          }
        }
      } else {
        throw insertErr;
      }
    }

    // Onboarding fires several requests at once; a concurrent request may have
    // completed the insert/migration while this one was still in the catch path.
    // Re-read by Clerk ID so we don't return a spurious 401 for a row that now
    // exists.
    if (!newUser) {
      [newUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, clerkUserId))
        .limit(1);
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

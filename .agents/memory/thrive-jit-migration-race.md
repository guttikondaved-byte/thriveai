---
name: Thrive JIT user-migration concurrency race
description: Why pre-Clerk→Clerk account migration in authMiddleware must be concurrency-safe, and how it's guarded.
---

# JIT pre-Clerk → Clerk migration must be concurrency-safe

On login the frontend fires **many API requests in parallel**. All of them hit
`authMiddleware`, miss the fast-path (Clerk-id row doesn't exist yet), and try to
migrate the same legacy account at once (legacy UUID id → Clerk id by reparenting
child rows then deleting the old row).

**Symptom:** every request throws `duplicate key value violates unique constraint
"users_email_unique"`, the migration transaction rolls back, and the user is stuck
in a permanent 401 loop on login. The logged error is the *first* insert's query,
which is misleading — the real cause is the concurrent collision, visible as a burst
of identical errors at near-identical timestamps.

**Fix (in `migrateUserToClerkId`):**
1. `SELECT pg_advisory_xact_lock(hashtext(email ?? oldId))` at the very top of the
   transaction to serialize migrations for the same account.
2. Re-check `SELECT 1 FROM users WHERE id = clerkUserId` *inside* the lock and
   return early if the row already exists (waiters no-op after the winner commits).
3. Make the insert idempotent: `INSERT ... ON CONFLICT (id) DO NOTHING`.

**Why:** without the lock, the recheck alone wouldn't help — all requests pass the
recheck simultaneously. The advisory lock forces them to take turns; the recheck
then lets every loser short-circuit.

**How to apply:** any JIT/first-request provisioning or one-time data migration that
runs inside request-handling middleware must assume N concurrent first requests, not
one. Serialize with an advisory lock keyed on the stable identity + recheck inside it.

**To unblock an already-stuck account manually:** run the same reparent-then-delete
steps as one atomic `DO $$ ... $$` block via `executeSql` (the `pg` package is not
importable at the workspace root in the code-execution sandbox — use `executeSql`).
Reparented child tables: athlete_profile, teams(coach_user_id),
team_memberships(athlete_user_id), notifications, strava_tokens, activities,
injury_alerts, training_plans, conversations. (`injuries` has no user_id column.)

# Detecting a Postgres constraint violation through drizzle's wrapped error

**drizzle-orm 0.45 `DrizzleQueryError.message` contains only the failed SQL + params
— NOT the constraint name or pg code.** Those live on the `.cause` chain (the raw pg
error: `.code === "23505"`, `.constraint === "users_email_unique"`).

**Symptom:** a `try/catch` that branches on `insertErr.message.includes("users_email_unique")`
silently never matches → the intended recovery path (e.g. email→Clerk migration) is
skipped, the error re-throws, `req.user` is never set, and the route returns a 401 that
looks like an auth bug but is really an unhandled DB conflict. (Hit on coach signup when
a leftover legacy UUID row held the new user's email.)

**Fix:** detect by walking the `.cause` chain checking message substring **and** pg
`code`/`constraint` fields (see `isEmailUniqueViolation` in authMiddleware). Also add a
post-catch fallback `SELECT ... WHERE id = clerkUserId` so a concurrent request that
already provisioned the row doesn't leave this request with a spurious 401.

**How to apply:** never match Postgres constraint/code logic against a drizzle error's
`.message`; inspect the cause chain. Applies to any `onConflictDoUpdate(target: id)` that
can still collide on a *different* unique column (here `email`).

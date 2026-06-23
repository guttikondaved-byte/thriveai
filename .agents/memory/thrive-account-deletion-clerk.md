---
name: Thrive account deletion must clear Clerk identity first
description: Why account deletion must delete the Clerk user BEFORE the DB row, as a hard precondition, or the account resurrects itself.
---

Deleting a Thrive account (DELETE /api/account) must remove both the Clerk identity and the local DB rows. The **ordering and failure handling are load-bearing** — getting them wrong produces two distinct bugs that both look like "deletion doesn't work."

**The durable principle: prevent JIT re-provisioning from resurrecting a deleting account.**
`authMiddleware` JIT-provisions a `users` row on any authed request whose Clerk session is valid but whose DB row is missing (fast-path miss → `clerkClient.users.getUser()` → insert). Account deletion races directly against this: the SPA holds a valid Clerk session for a moment after the delete and immediately refetches authed endpoints (profile, notifications).

**Why ordering matters (two observed bugs):**
- *DB-first ordering (wrong):* delete the DB row, then the Clerk user. The post-delete refetch misses the fast path, JIT calls `getUser()` which still succeeds, and the row is **re-inserted — the email reappears in the DB**. User is logged out but the email is never removed. This was the reported bug.
- *Best-effort Clerk delete (wrong):* if the Clerk delete is swallowed on failure but the DB delete still commits, the surviving Clerk session re-provisions later and resurrects the account.

**How to apply — the correct shape:**
1. Delete the Clerk user FIRST, as a **hard precondition**, before touching the DB. Once the Clerk user is gone, any racing `getUser()` 404s and JIT provisioning aborts instead of recreating the row.
2. Treat a 404 from `deleteUser` as success (identity already gone — e.g. a retry or dashboard deletion); continue.
3. On any other Clerk-delete error, **abort the request (do not delete the DB)** and let the client retry. Half-deleting (DB gone, Clerk alive) is the resurrection bug.
4. Only after Clerk deletion succeeds, run the DB transaction (delete all child rows + the `users` row by id) and clear the legacy session.
5. Client: after a successful delete, `useClerk().signOut({ redirectUrl: "/" })`; on signOut failure still force `window.location.href = "/"`.

Signed-out routing is already correct (`HomeContent` renders the landing page when `!isSignedIn`); a "lands on onboarding/login instead of landing" symptom is a stale-session/resurrection issue, not a routing bug.

---
name: Thrive account deletion must clear Clerk identity
description: Why deleting a local account has to also delete + sign out the Clerk user, or the app traps the user in onboarding.
---

Deleting a Thrive account (DELETE /api/account) removes local DB rows + the legacy session. That alone is NOT enough: the Clerk identity/session is separate and survives.

**Why:** If the Clerk session lives on after deletion, the next request still has `isSignedIn === true`. `authMiddleware` JIT-reprovisions a fresh, role-less user row, and `AppContent` force-redirects to `/onboarding`. The user perceives this as "the app takes me straight to account creation/login" and can never reach the signed-out landing page.

**How to apply:** On any flow that deletes a user account, do both:
1. Server: after the DB transaction, call `clerkClient.users.deleteUser(userId)` (best-effort — wrap in try/catch, log on failure, don't 500; local deletion already committed).
2. Client: after a successful delete response, call `useClerk().signOut({ redirectUrl: "/" })` instead of a plain redirect. If signOut throws, still force `window.location.href = "/"` since the account is already gone.

Signed-out routing is already correct: `HomeContent` renders the `Login` (landing) component when `!isSignedIn`. The landing-vs-auth problem is almost always a stale-session issue, not a routing bug.

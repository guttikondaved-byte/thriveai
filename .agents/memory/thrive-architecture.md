---
name: Thrive app architecture
description: Key decisions, file locations, and quirks for the Thrive running coach web app
---

## App identity
- Product name: **Thrive**, AI coach: **AveraAI**
- Artifact slug: `stride-iq`, preview path `/`, dir: `artifacts/stride-iq`
- DB schema: `lib/db/src/schema/` (athlete.ts, activities.ts, trainingPlans.ts, alerts.ts, conversations.ts, messages.ts)

## Auth — Clerk (replaced custom email/password)
- `@clerk/react` client, `@clerk/express` server; Google + email/password enabled
- `authMiddleware.ts` uses `getAuth(req)` → DB lookup → JIT-provision via `clerkClient.users.getUser()`
- Users table `id` is varchar PK storing Clerk `user_xxx` IDs
- Clerk proxy path `/api/__clerk` (no-op in dev, active in prod)
- Client: `useUser()` for user info, `useClerk().signOut({ redirectUrl: "/" })` for logout
- Tailwind v4 Clerk layer: `@layer theme, base, clerk, components, utilities` before `@import 'tailwindcss'`; `tailwindcss({ optimize: false })` in vite.config.ts; `cssLayerName: "clerk"` in appearance
- Sign-in: `/sign-in/*?`, sign-up: `/sign-up/*?` (Clerk `routing="path"`)
- Landing page (`pages/login.tsx`) shown when `!isSignedIn`; role picker buttons both navigate to `/sign-up`

## AI integration quirk
- OpenAI integration (`setupReplitAIIntegrations`) may return `awaiting_phone_verification` — means AI env vars not set
- `openai.ts` route handles this gracefully via dynamic import + env var check
- When AI is unavailable, SSE endpoint returns a fallback message explaining AI is not configured

## Avera chat — SSE pattern
- POST `/api/openai/conversations/:id/messages` returns `text/event-stream`
- Frontend uses raw `fetch` + `ReadableStream` — NOT the generated hook
- Messages stored in DB after streaming completes

## Mutation shape
- All generated mutations use `{ data: T }` wrapper shape (orval convention)

## Nested `<a>` fix
- wouter's `<Link>` renders an `<a>` tag itself — never wrap it with another `<a>` tag
- Pass className/data-testid directly to `<Link>`, not to a child `<a>`

## Pages
- `/` Dashboard, `/activities`, `/plans`, `/plans/:id`, `/alerts`, `/coach`, `/profile`
- Layout: `artifacts/stride-iq/src/components/Layout.tsx`

**Why:** Recorded to avoid re-discovering the phone verification issue and SSE streaming pattern.

## Coach role routing (verified working)
- App.tsx routes by `profile.userRole === "coach"` → CoachRouter (CoachLayout "Coach Portal"), else AthleteRouter. Backend GET /api/athlete/profile returns userRole correctly; signup+login both verified via Playwright to reach the coach dashboard.
- **If a user reports coach routing "still broken" but tests pass:** suspect a stale cached frontend bundle in their preview iframe. Restart the `artifacts/stride-iq: web` workflow and have them hard-refresh. The code path is correct.

## Coach↔athlete relationship (the real ownership model)
- There IS a coach↔athlete link: `teams` (coachUserId, inviteCode) + `team_memberships` (teamId, athleteUserId). Coach creates a team; athletes join via invite code. Coach dashboard AND Team page both render real rosters from `GET /api/teams/:id/members` (no more mock `TEAM` array).
- Coach-authorized athlete data must check `team.coachUserId === req.user.id` AND that the target athlete has a membership row in that team. Pattern used by `GET /api/teams/:teamId/members/:userId/profile` (full profile: fields + weekly distance + recent activities + active injury alerts). The list endpoint `GET /api/teams/:teamId/members` is enriched with per-athlete weeklyDistanceKm, RHR, HRV, primaryGoal, fitnessLevel, and highest active alert riskLevel.
- Shared UI: `src/components/AthleteProfileModal.tsx` (self-fetches by teamId+userId; loading/error/retry) is reused by both coach dashboard and Team page roster — clicking any athlete row opens it.
- Team page (`pages/team.tsx`) is role-gated via `useGetAthleteProfile().userRole`: coaches create teams + see the management view (roster/invite/strava); athletes only see "Join a team" then a simple confirmation. The coach-only endpoints (`/members`, `/strava-status`) must NOT be fetched for athletes (they 403). Team creation (`POST /teams`) is enforced coach-only server-side (checks `athleteProfileTable.userRole === "coach"`), not just hidden in UI.
- **Why:** Team page is one shared component for both roles; without role-gating, athletes hit coach-only 403s after joining and saw create-team UI. userRole lives on `athlete_profile`, not `users`.
- **Why:** userId-isolation means a coach can't read another user's rows by default; team membership is the only sanctioned cross-user read path. Always scope coach reads through team ownership + membership, never by userId alone.

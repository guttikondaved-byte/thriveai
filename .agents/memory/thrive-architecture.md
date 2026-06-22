---
name: Thrive app architecture
description: Key decisions, file locations, and quirks for the Thrive running coach web app
---

## App identity
- Product name: **Thrive**, AI coach: **Avera**
- Artifact slug: `stride-iq`, preview path `/`, dir: `artifacts/stride-iq`
- DB schema: `lib/db/src/schema/` (athlete.ts, activities.ts, trainingPlans.ts, alerts.ts, conversations.ts, messages.ts)

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
- There IS a coach↔athlete link: `teams` (coachUserId, inviteCode) + `team_memberships` (teamId, athleteUserId). Coach creates a team; athletes join via invite code. The coach dashboard's hardcoded `TEAM` array is mock UI only — real roster comes from `GET /api/teams/:id/members`.
- Coach-authorized athlete data must check `team.coachUserId === req.user.id` AND that the target athlete has a membership row in that team. Pattern used by `GET /api/teams/:teamId/members/:userId/profile` (coach-facing athlete profile: profile fields + weekly distance + recent activities + active injury alerts).
- **Why:** userId-isolation means a coach can't read another user's rows by default; team membership is the only sanctioned cross-user read path. Always scope coach reads through team ownership + membership, never by userId alone.

# Thrive (StrideIQ)

A full-stack running athlete platform with AI coaching, injury risk detection, Strava sync, and training plans for student athletes and coaches.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind v4 (artifact `stride-iq` at `/`)
- API: Express 5 (artifact `api-server` at `/api`)
- DB: PostgreSQL + Drizzle ORM
- Auth: Clerk (Google + email/password); `@clerk/react` on client, `@clerk/express` on server
- AI: GLM-4-Flash via `GLM_API_KEY` (AI coach "AveraAI")
- Strava integration for activity sync

## Where things live

- `artifacts/stride-iq/src/App.tsx` — ClerkProvider, route tree, auth guard
- `artifacts/stride-iq/src/pages/login.tsx` — Landing page (shown when signed out)
- `artifacts/stride-iq/src/pages/onboarding.tsx` — role + profile setup after sign-up
- `artifacts/api-server/src/app.ts` — Express app, Clerk middleware wiring
- `artifacts/api-server/src/middlewares/authMiddleware.ts` — Clerk getAuth + JIT user provisioning
- `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts` — prod Clerk FAPI proxy
- `lib/db/src/schema.ts` — source-of-truth DB schema

## Architecture decisions

- **Clerk for auth** — Google sign-in + email/password; users table uses Clerk's user ID as primary key (varchar). JIT provisioning in `authMiddleware.ts` creates a local DB row on first request.
- **Dark navy/cyan theme** — default dark mode; all CSS variables set in `:root` matching the dark theme directly.
- **Distance units are MILES** — `distance_km` / `weeklyDistanceKm` columns store miles (historical naming). Never multiply by 0.621371.
- **Tailwind v4** — uses `@tailwindcss/vite` plugin with `optimize: false`. CSS layers declared as `@layer theme, base, clerk, components, utilities` before `@import 'tailwindcss'`.
- **Contract-first API** — OpenAPI spec → Orval codegen → React Query hooks used throughout the frontend.

## Product

- **Student Athlete**: log runs, view AI-generated training plans, get injury risk alerts, chat with AveraAI, sync Strava, join a team.
- **Coach**: manage team roster, view per-athlete workload and risk dashboard, get AI-powered roster summaries.
- **AveraAI**: GLM-4-flash powered coach that answers questions using the athlete's real training data.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- esbuild rejects `x ?? y || z` — always write `(x ?? y) || z`.
- Clerk dev key warning in browser console is expected and harmless.
- `authMiddleware.ts` JIT-provisions users: Clerk user ID → local DB row. The users table `id` column is a varchar PK that stores Clerk's `user_xxx` IDs.
- Clerk proxy middleware (`/api/__clerk`) is a no-op in dev; only active in production.
- All API routes require the request to pass through `authMiddleware` which sets `req.user` from Clerk's session token.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `clerk-auth` skill for Clerk setup details and customisation

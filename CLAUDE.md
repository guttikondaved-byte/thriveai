# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo structure

pnpm workspace with three layers:
- `lib/` — shared packages (`@workspace/db`, `@workspace/api-zod`, `@workspace/api-client-react`, etc.)
- `artifacts/` — deployable apps (`api-server`, `stride-iq` frontend, `mockup-sandbox`)
- `scripts/` — one-off tooling

Key shared packages:
- `lib/db` — Drizzle ORM schema + Postgres client (`@workspace/db`). Schema lives in `lib/db/src/schema/`. Push changes with `pnpm --filter @workspace/db push` (requires `DATABASE_URL`).
- `lib/api-zod` — Zod schemas generated from the OpenAPI spec in `lib/api-spec/openapi.yaml`. These are the source of truth for request/response types shared between API and frontend.
- `lib/api-client-react` — Generated React Query hooks for all API endpoints, consumed by the frontend.

## Commands

```bash
# Install all workspace deps
pnpm install

# If pnpm blocks native build scripts
pnpm approve-builds --all && pnpm install

# Start frontend (port 3000, hot-reload)
pnpm --filter ./artifacts/stride-iq dev

# Start API server (builds first, then runs on PORT)
cd artifacts/api-server && pnpm dev   # reads .env.local

# Push DB schema to Postgres
pnpm --filter @workspace/db push

# Typecheck everything
pnpm typecheck
```

## API server

Express app in `artifacts/api-server/src/`. Built with a custom esbuild script (`build.mjs`) into `dist/index.mjs` before running — there is no ts-node/tsx watch mode, only build-then-run.

- Auth: Clerk via `@clerk/express`. `authMiddleware` at `src/middlewares/authMiddleware.ts` JIT-provisions users into the `users` table on first request using the Clerk user ID as the primary key.
- Routes: all under `/api`, registered in `src/routes/index.ts`.
- DB access: drizzle-orm with `pg` (node-postgres). The `@workspace/db` package exports the drizzle client and all table definitions.
- Logging: pino + pino-http. Use `req.log` inside route handlers.

Required env vars (`artifacts/api-server/.env.local`):
```
PORT=8080
DATABASE_URL=postgresql://...?sslmode=require   # Render external URL requires sslmode=require
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
APP_PUBLIC_URL=http://localhost:3000
```

## Frontend (stride-iq)

Vite + React 19 app in `artifacts/stride-iq/src/`. Routing via wouter. State via React Query (TanStack Query v5).

Auth flow in `App.tsx`:
1. `ClerkProvider` wraps everything; sign-in/sign-up routes handled by Clerk components.
2. Once signed in, `ClerkAuthTokenProvider` registers `getToken()` as a Bearer header getter for all API calls.
3. `AppContent` fetches `GET /api/athlete/profile` — if `userRole` is null, redirects to `/onboarding`.
4. After onboarding sets `userRole`, routes to `AthleteRouter` or `CoachRouter` based on role.

Required env vars (`artifacts/stride-iq/.env.local`):
```
VITE_CLERK_PUBLISHABLE_KEY=pk_...
VITE_CLERK_PROXY_URL=        # leave empty in local dev
```

The Vite dev server proxies all `/api/*` requests to `localhost:8080` (see `vite.config.ts`).

## Database schema

Schema files in `lib/db/src/schema/`. Key tables:
- `users` — Clerk user ID (`varchar`) is the PK; JIT-provisioned by `authMiddleware`.
- `athlete_profile` — one-to-one with `users`, created on first `GET /api/athlete/profile`.
- `sessions` — Replit Auth legacy sessions table; keep it, don't drop it.

To add a column: edit the schema file → run `pnpm --filter @workspace/db push`.

## Deployment

- Frontend → Netlify (`netlify.toml` at root). All non-asset routes rewrite to `index.html`.
- API → Render (`render.yaml`). Uses internal Render Postgres URL in prod; use external URL with `?sslmode=require` for local dev.

## Known quirks

- pnpm v9 is required (latest pnpm requires Node ≥22.12; this repo runs on Node 22.1). Install with `npm install -g pnpm@9 --force`.
- The `DATABASE_URL` for the Render-hosted Postgres must include `?sslmode=require` when connecting externally.
- `lib/auth.ts` contains a legacy Replit OIDC session system — it is not used by the current Clerk auth flow but must stay (the `sessions` table is referenced by it).

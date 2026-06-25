## ThriveAI — Local development quickstart

This repository is a pnpm TypeScript monorepo containing a React frontend (Vite) and an Express API server. This README collects the most-used commands, environment variables, and quick troubleshooting tips so you can get the project running locally fast.

Short plan
- Install Node + pnpm
- Install workspace dependencies
- Start the frontend (Vite)
- (Optional) Build & start the API server

Prerequisites
- macOS (this doc uses zsh)
- Homebrew (recommended) or a Node installer

Install Node and pnpm (recommended)
```bash
# Install Node (Homebrew)
brew install node

# Install pnpm (Homebrew)
brew install pnpm

# Alternatively (npm):
# npm install -g pnpm
```

Workspace install
```bash
cd /path/to/repo # e.g. /Users/vitteshtaneja/Leangap
pnpm install

# If pnpm blocks optional native build scripts, approve them once:
pnpm approve-builds --all
pnpm install
```

Frontend (stride-iq)
- Default dev port: 3000

Dev (hot-reload)
```bash
pnpm --filter ./artifacts/stride-iq dev
```

Build preview
```bash
pnpm --filter ./artifacts/stride-iq run build
pnpm --filter ./artifacts/stride-iq run serve
```

API server (artifacts/api-server)
- The server is built with an esbuild script into `dist/*.mjs` and run with Node.

Build and start (example)
```bash
# Provide env first (example):
export NODE_ENV=development
export PORT=8080
export DATABASE_URL="postgres://user:pass@localhost:5432/dbname"
# Optional integration keys
# export STRAVA_CLIENT_ID=...
# export STRAVA_CLIENT_SECRET=...
# export CLERK_PUBLISHABLE_KEY=pk_...
# export CLERK_SECRET_KEY=sk_...
# export OPENAI_API_KEY=sk-...

pnpm --filter ./artifacts/api-server run build
pnpm --filter ./artifacts/api-server run start
```

Common maintenance commands
```bash
# Clean and reinstall dependencies
rm -rf node_modules
pnpm install --prefer-frozen-lockfile

# Rebuild rollup/native bindings if you run into missing native optional packages
pnpm rebuild rollup

# If you see errors about missing native packages, you can add them at workspace root
# Example (darwin/arm64):
pnpm add -Dw @rollup/rollup-darwin-arm64 lightningcss-darwin-arm64 @tailwindcss/oxide-darwin-arm64

# Approve build scripts when pnpm blocks them
pnpm approve-builds --all
```

Environment variables (minimal)
- Frontend (`artifacts/stride-iq/.env.local`)
```
VITE_CLERK_PUBLISHABLE_KEY=pk_...    # required by frontend (Clerk)
# Leave proxy empty for normal CDN loading
VITE_CLERK_PROXY_URL=
```

- API server (example `.env.local` located near repo root or exported in shell)
```
PORT=8080
DATABASE_URL=postgres://user:pass@localhost:5432/dbname
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
OPENAI_API_KEY=sk-...
```

Clerk runtime error: "failed to load Clerk JS" (clerk.localhost)
- Symptom: Browser console shows an error like:
  "Clerk: Failed to load Clerk JS, failed to load script: https://clerk.localhost/npm/... (code=failed_to_load_clerk_js)"

Fast dev fix
- The frontend reads `VITE_CLERK_PROXY_URL` and passes it to `ClerkProvider.proxyUrl`. In dev, leave `VITE_CLERK_PROXY_URL` empty so the SDK loads the hosted Clerk script instead of `clerk.localhost`:

1. Create `artifacts/stride-iq/.env.local` with `VITE_CLERK_PUBLISHABLE_KEY` and an empty `VITE_CLERK_PROXY_URL`.
2. Restart Vite.

Proxy-based approach (optional)
- The repo includes a Clerk proxy middleware at `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts`. It only activates when `NODE_ENV === "production"` and `CLERK_SECRET_KEY` is set.
- To use the proxy locally:
  - Add an /etc/hosts entry: `127.0.0.1 clerk.localhost`
  - Run the API server with `NODE_ENV=production` and `CLERK_SECRET_KEY` set.
  - Start the frontend; it will request Clerk assets through `clerk.localhost` which the API server proxies to Clerk.

Troubleshooting
- If Vite fails with native-binding / optional dependency errors:
  - Try `pnpm approve-builds --all` and `pnpm install`.
  - If particular native bindings are missing, add the platform-specific package (see "Common maintenance commands").
- If the frontend throws `Missing VITE_CLERK_PUBLISHABLE_KEY`, set `VITE_CLERK_PUBLISHABLE_KEY` in `artifacts/stride-iq/.env.local`.
- DB connection errors: check `DATABASE_URL` and ensure Postgres is running and reachable.

Quick checklist (copy-paste)
```bash
# 1) Install prerequisites
brew install node pnpm

# 2) Install deps
pnpm install
pnpm approve-builds --all

# 3) Start frontend
pnpm --filter ./artifacts/stride-iq dev

# 4) (Optional) Build & start API server
export DATABASE_URL=postgres://user:pass@localhost:5432/dbname
pnpm --filter ./artifacts/api-server run build
pnpm --filter ./artifacts/api-server run start
```

Where to look for more context
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- API server source: `artifacts/api-server/src`
- Frontend source: `artifacts/stride-iq/src`

If you want, I can also:
- Generate a `.env.example` file in both `artifacts/stride-iq` and `artifacts/api-server`.
- Add a small `scripts/dev.sh` that starts both frontend and backend with sensible defaults.

---
Generated by automation to capture repo run steps. Update this file with any project-specific notes.


Terminal 1 backend: # from repo root
cd "$(pwd)"
pnpm --filter ./artifacts/api-server run dev
# This builds then runs the server (reads artifacts/api-server/.env.local)


Terminal 2 Frontend: # from repo root
pnpm --filter ./artifacts/stride-iq run dev
# Vite will serve the app (usually http://localhost:3000)
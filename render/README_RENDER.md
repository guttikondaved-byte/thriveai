Render deployment guide for ThriveAI

This document explains how to deploy the repo to Render using the included `render.yaml` manifest. It covers creating the managed Postgres, setting environment variables, and connecting frontend and API services.

1) Prepare the repository
- Ensure your `main` branch is up-to-date in the remote Git provider (GitHub/GitLab).

2) Import to Render
- In the Render dashboard, choose "New -> Import from GitHub/GitLab" and select this repository.
- Render will detect `render.yaml` and propose the resources defined there.

3) Configure secrets and environment variables
- In the Render dashboard (for each service), set the following environment variables using the Secrets UI:
  - For `thriveai-api` (Web Service):
    - DATABASE_URL (Render will provide a connection string if you attach the managed DB)
    - CLERK_PUBLISHABLE_KEY (secret)
    - CLERK_SECRET_KEY (secret)
    - STRAVA_CLIENT_ID (secret)
    - STRAVA_CLIENT_SECRET (secret)
    - OPENAI_API_KEY (secret)

  - For `thriveai-frontend` (Static site):
    - VITE_CLERK_PUBLISHABLE_KEY
    - VITE_CLERK_PROXY_URL (leave empty to load Clerk CDN)

4) Build and deploy
- Once env vars are set, trigger a deploy in the Render dashboard. Render will run the `buildCommand` and publish the site.

Notes and troubleshooting
- The API service expects `DATABASE_URL` to be set. If you created a managed DB in the manifest, attach it to the service or copy the connection string into the service env.
- Clerk proxy path: this repo's API server can proxy Clerk requests when `CLERK_SECRET_KEY` is present and the server runs in `production` mode. If you want to proxy Clerk through the API, set `VITE_CLERK_PROXY_URL` to the API URL (e.g. `https://thriveai-api.onrender.com/api/__clerk`) in the frontend service env.
- If your build fails due to optional native packages, ensure Render runs `pnpm approve-builds --all` before `pnpm install` or add the optional native packages to the root devDependencies in `package.json`.

#!/usr/bin/env bash
set -euo pipefail

# scripts/deploy-netlify.sh
# Deploy the frontend to Netlify using the Netlify CLI.
# Requirements:
# - netlify cli installed (`npm i -g netlify-cli`) or `brew install netlify-cli`
# - NETLIFY_SITE_ID set in the environment (get from Netlify site settings)
# - VITE_CLERK_PUBLISHABLE_KEY set in env for the build, if required

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v netlify >/dev/null 2>&1; then
  echo "netlify CLI is not installed. Install with: npm i -g netlify-cli" >&2
  exit 1
fi

if [ -z "${NETLIFY_SITE_ID:-}" ]; then
  echo "Please set NETLIFY_SITE_ID environment variable with your Netlify site id." >&2
  echo "Example: export NETLIFY_SITE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" >&2
  exit 1
fi

echo "Installing dependencies and building frontend..."
pnpm install
pnpm --filter ./artifacts/stride-iq run build

echo "Deploying to Netlify (site id: $NETLIFY_SITE_ID)"
netlify deploy --site "$NETLIFY_SITE_ID" --prod --dir "$ROOT_DIR/artifacts/stride-iq/dist/public"

echo "Deployment finished."

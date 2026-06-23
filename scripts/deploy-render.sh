#!/usr/bin/env bash
set -euo pipefail

# scripts/deploy-render.sh
# Apply the Render manifest (render.yaml) using the Render CLI.
# Requirements:
# - render CLI installed (see https://render.com/docs/render-cli)
# - You are logged in (`render login`)
# - Optionally: RENDER_SERVICE_ID or other envs set if you want to configure specific services

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v render >/dev/null 2>&1; then
  echo "render CLI is not installed. Follow: https://render.com/docs/render-cli" >&2
  exit 1
fi

if [ ! -f "render.yaml" ]; then
  echo "render.yaml not found in repo root. Aborting." >&2
  exit 1
fi

echo "Applying render.yaml manifest..."
render services create --file render.yaml || render services update --file render.yaml

echo "Render manifest applied. Open the Render dashboard to complete any missing secrets or DB attachments." 

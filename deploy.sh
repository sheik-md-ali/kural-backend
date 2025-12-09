#!/usr/bin/env bash
set -euo pipefail

# Load nvm to get node/npm/pm2 in PATH (required for non-interactive SSH)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

BRANCH="${BRANCH:-main}"
PM2_PROCESS_NAME="${PM2_PROCESS_NAME:-kural-backend}"

echo "==> Deploying branch: ${BRANCH}"
echo "==> Node version: $(node -v)"
echo "==> NPM version: $(npm -v)"

cd "$(dirname "$0")"

echo "==> Fetching latest code"
git fetch origin "${BRANCH}"
git reset --hard "origin/${BRANCH}"

echo "==> Installing npm dependencies"
npm ci

echo "==> Building application"
npm run build

echo "==> Restarting PM2 process: ${PM2_PROCESS_NAME}"
pm2 restart "${PM2_PROCESS_NAME}" --update-env || {
  echo "==> Process not found, starting fresh with ecosystem.config.cjs"
  pm2 start ecosystem.config.cjs --env production --update-env
}

echo "==> Deployment complete"
pm2 list


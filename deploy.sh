#!/usr/bin/env bash
set -euo pipefail

BRANCH="${BRANCH:-main}"
PM2_PROCESS_NAME="${PM2_PROCESS_NAME:-kuralapp-backend}"

echo "==> Deploying branch: ${BRANCH}"

cd "$(dirname "$0")"

echo "==> Fetching latest code"
git fetch origin "${BRANCH}"
git reset --hard "origin/${BRANCH}"

echo "==> Installing npm dependencies"
npm ci

echo "==> Building application"
npm run build

echo "==> Reloading PM2 process: ${PM2_PROCESS_NAME}"
pm2 describe "${PM2_PROCESS_NAME}" >/dev/null 2>&1 && pm2 restart "${PM2_PROCESS_NAME}" || pm2 start npm --name "${PM2_PROCESS_NAME}" -- start

echo "==> Deployment complete"


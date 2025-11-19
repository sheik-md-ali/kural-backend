#!/usr/bin/env bash
set -euo pipefail

BRANCH="${BRANCH:-main}"
PM2_PROCESS_NAME="${PM2_PROCESS_NAME:-kuralapp-website}"

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
pm2 restart "${PM2_PROCESS_NAME}"

echo "==> Deployment complete"


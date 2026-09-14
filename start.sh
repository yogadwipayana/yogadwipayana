#!/usr/bin/env bash
# Deploy without taking the site down during the build: build into a separate
# directory while the current server keeps serving, then swap and restart.
set -euo pipefail
cd "$(dirname "$0")"

APP=yogadwipayana
BUILD_DIR=.next-build

git stash
git fetch
git pull
npm install

rm -rf "$BUILD_DIR"
NEXT_DIST_DIR="$BUILD_DIR" npm run build

# Keep the previous build in .next-old for a quick manual rollback.
rm -rf .next-old
if [ -d .next ]; then
  mv .next .next-old
fi
mv "$BUILD_DIR" .next

if pm2 describe "$APP" > /dev/null 2>&1; then
  PORT=3000 pm2 restart "$APP" --update-env
else
  PORT=3000 pm2 start npm --name "$APP" -- run start
fi

pm2 save

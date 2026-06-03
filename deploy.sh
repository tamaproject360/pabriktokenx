#!/bin/sh
set -eu

SRC=${PABRIKTOKENX_RELEASE_DIR:-/tmp/pabriktokenx-ci}
DEST=/opt/pabriktokenx
LOCK=/tmp/pabriktokenx-deploy.lock

while ! mkdir "$LOCK" 2>/dev/null; do
  echo "[deploy] another deploy is running; waiting"
  sleep 5
done
trap 'rmdir "$LOCK"' EXIT INT TERM

mkdir -p "$DEST"
cd "$SRC"

echo "[deploy] syncing release to $DEST"
tar \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='.git' \
  --exclude='config.docker.yaml' \
  --exclude='*.bak*' \
  --exclude='*.orig' \
  --exclude='auths' \
  --exclude='logs' \
  --exclude='assets' \
  --exclude='node_modules' \
  --exclude='frontend/node_modules' \
  --exclude='__pycache__' \
  -cf - . | tar -C "$DEST" -xf -

cd "$DEST"

echo "[deploy] starting pabriktokenx deploy"
docker compose up -d --build
docker image prune -f >/dev/null 2>&1 || true

echo "[deploy] containers"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E '(^NAMES|pabriktokenx)' || true

echo "[deploy] done"

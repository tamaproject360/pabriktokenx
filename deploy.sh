#!/bin/sh
set -eu

cd /opt/pabriktokenx

echo "[deploy] starting pabriktokenx deploy"
docker compose up -d --build
docker image prune -f >/dev/null 2>&1 || true

echo "[deploy] containers"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E '(^NAMES|pabriktokenx)' || true

echo "[deploy] done"

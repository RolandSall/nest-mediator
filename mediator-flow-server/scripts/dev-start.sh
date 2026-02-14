#!/bin/sh
set -e

# ──────────────────────────────────────────────────────────────────────────────
# dev-start.sh — Start DB + API for local testing, then open .http requests
#
# Usage:
#   ./scripts/dev-start.sh          # start everything
#   ./scripts/dev-start.sh stop     # tear down everything
# ──────────────────────────────────────────────────────────────────────────────

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

API_PORT=4800
API_PID_FILE="$PROJECT_DIR/.api.pid"

stop_all() {
  echo ""
  echo "[dev] Stopping..."

  # Stop API
  if [ -f "$API_PID_FILE" ]; then
    API_PID=$(cat "$API_PID_FILE")
    if kill -0 "$API_PID" 2>/dev/null; then
      kill "$API_PID" 2>/dev/null
      echo "[dev] API stopped (pid $API_PID)"
    fi
    rm -f "$API_PID_FILE"
  fi

  # Stop DB
  docker compose -f docker-compose.dev.yml down 2>/dev/null
  echo "[dev] Database stopped."
  exit 0
}

if [ "${1:-}" = "stop" ]; then
  stop_all
fi

trap stop_all INT TERM

echo "=========================================="
echo "  MediatorFlow — Local Dev Startup"
echo "=========================================="
echo ""

# ── 1. Start PostgreSQL ─────────────────────────────────────────────────────
echo "[dev] Starting PostgreSQL container..."
docker compose -f docker-compose.dev.yml up -d

echo "[dev] Waiting for PostgreSQL to be healthy..."
for i in $(seq 1 30); do
  if docker compose -f docker-compose.dev.yml exec -T postgres pg_isready -U mediatorflow -d mediatorflow -q 2>/dev/null; then
    echo "[dev] PostgreSQL is ready (after ${i}s)."
    break
  fi
  if [ "$i" = "30" ]; then
    echo "[dev] ERROR: PostgreSQL did not become ready within 30 seconds."
    exit 1
  fi
  sleep 1
done

# ── 2. Start API in background ──────────────────────────────────────────────
echo "[dev] Starting API server..."

# Kill stale API if still running
if [ -f "$API_PID_FILE" ]; then
  OLD_PID=$(cat "$API_PID_FILE")
  kill "$OLD_PID" 2>/dev/null || true
  rm -f "$API_PID_FILE"
fi

npx ts-node -T src/main.ts > /tmp/mediatorflow-api.log 2>&1 &
API_PID=$!
echo "$API_PID" > "$API_PID_FILE"

echo "[dev] Waiting for API on port $API_PORT..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w '' "http://localhost:$API_PORT/api/stats" 2>/dev/null; then
    echo "[dev] API is ready (after ${i}s)."
    break
  fi
  if [ "$i" = "30" ]; then
    echo "[dev] ERROR: API did not start within 30 seconds."
    echo "[dev] Check logs: cat /tmp/mediatorflow-api.log"
    exit 1
  fi
  sleep 1
done

# ── 3. Done ──────────────────────────────────────────────────────────────────
echo ""
echo "=========================================="
echo "  Everything is running!"
echo ""
echo "  API:       http://localhost:$API_PORT"
echo "  Database:  localhost:5433"
echo "  API logs:  tail -f /tmp/mediatorflow-api.log"
echo ""
echo "  Now open in WebStorm:"
echo "    tests/api.http"
echo ""
echo "  Select the \"dev\" environment and run"
echo "  requests top-to-bottom."
echo ""
echo "  To stop:   ./scripts/dev-start.sh stop"
echo "  Or press:  Ctrl+C"
echo "=========================================="

# Keep script alive so Ctrl+C triggers cleanup
wait "$API_PID"

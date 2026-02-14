#!/bin/sh
set -e

echo "========================================"
echo "  MediatorFlow Server"
echo "========================================"

# ── Detect whether to use embedded or external PostgreSQL ────────────────────
# If DATABASE_URL points to localhost (or is unset), we start the embedded
# PostgreSQL bundled in the image.  If it points anywhere else, we skip the
# embedded instance and connect to the external database directly.
#
# Examples:
#   Embedded (default):  DATABASE_URL=postgres://mediatorflow:mediatorflow@localhost:5432/mediatorflow
#   External:            DATABASE_URL=postgres://user:pass@my-rds.amazonaws.com:5432/mediatorflow

USE_EMBEDDED_PG=true

if [ -n "$DATABASE_URL" ]; then
  # Extract host from the URL: postgres://user:pass@HOST:port/db
  DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|^[^@]+@([^:/?]+).*|\1|')
  case "$DB_HOST" in
    localhost|127.0.0.1|"")
      USE_EMBEDDED_PG=true
      ;;
    *)
      USE_EMBEDDED_PG=false
      ;;
  esac
fi

PG_PID=""

if [ "$USE_EMBEDDED_PG" = "true" ]; then
  # ── 1a. Start embedded PostgreSQL in the background ──────────────────────────
  echo "[entrypoint] Mode: EMBEDDED PostgreSQL"
  echo "[entrypoint] Starting PostgreSQL..."
  docker-entrypoint.sh postgres &
  PG_PID=$!

  # ── 2a. Wait for embedded PostgreSQL to accept connections ───────────────────
  echo "[entrypoint] Waiting for PostgreSQL to be ready..."
  for i in $(seq 1 30); do
    if pg_isready -U "${POSTGRES_USER:-mediatorflow}" -d "${POSTGRES_DB:-mediatorflow}" -h localhost -q 2>/dev/null; then
      echo "[entrypoint] PostgreSQL is ready (after ${i}s)."
      break
    fi
    if [ "$i" = "30" ]; then
      echo "[entrypoint] ERROR: PostgreSQL did not become ready within 30 seconds."
      exit 1
    fi
    sleep 1
  done

  # ── 3a. Apply database schema (idempotent) ──────────────────────────────────
  echo "[entrypoint] Applying schema migration..."
  psql -U "${POSTGRES_USER:-mediatorflow}" -d "${POSTGRES_DB:-mediatorflow}" -f /app/schema.sql 2>/dev/null \
    || echo "[entrypoint] Schema already up to date."
  echo "[entrypoint] Migration complete."

else
  # ── 1b. External database — just apply schema via DATABASE_URL ──────────────
  echo "[entrypoint] Mode: EXTERNAL PostgreSQL ($DB_HOST)"
  echo "[entrypoint] Waiting for external database to be reachable..."

  for i in $(seq 1 30); do
    if node -e "
      const { Pool } = require('pg');
      const p = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
      p.query('SELECT 1').then(() => { p.end(); process.exit(0); }).catch(() => process.exit(1));
    " 2>/dev/null; then
      echo "[entrypoint] External database is reachable (after ${i}s)."
      break
    fi
    if [ "$i" = "30" ]; then
      echo "[entrypoint] ERROR: External database not reachable within 30 seconds."
      exit 1
    fi
    sleep 1
  done

  echo "[entrypoint] Applying schema migration to external database..."
  node -e "
    const { Pool } = require('pg');
    const fs = require('fs');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    const sql = fs.readFileSync('/app/schema.sql', 'utf8');
    pool.query(sql).then(() => { console.log('[entrypoint] Migration complete.'); pool.end(); })
      .catch(e => { console.log('[entrypoint] Schema already up to date.'); pool.end(); });
  "
fi

# ── 4. Start the Node.js API server ──────────────────────────────────────────
echo "[entrypoint] Starting API on port ${PORT:-4800}..."
cd /app
node dist/main.js &
NODE_PID=$!

# ── 5. Graceful shutdown ─────────────────────────────────────────────────────
shutdown() {
  echo "[entrypoint] Shutting down..."
  kill "$NODE_PID" 2>/dev/null
  if [ -n "$PG_PID" ]; then
    kill "$PG_PID" 2>/dev/null
    wait "$PG_PID" 2>/dev/null
  fi
  wait "$NODE_PID" 2>/dev/null
  echo "[entrypoint] Stopped."
}
trap shutdown SIGTERM SIGINT

echo "========================================"
if [ "$USE_EMBEDDED_PG" = "true" ]; then
  echo "  Mode:  Embedded PostgreSQL"
else
  echo "  Mode:  External PostgreSQL ($DB_HOST)"
fi
echo "  Ready: http://localhost:${PORT:-4800}"
echo "========================================"

# Wait for running processes
if [ -n "$PG_PID" ]; then
  wait "$NODE_PID" "$PG_PID"
else
  wait "$NODE_PID"
fi

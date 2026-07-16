#!/bin/sh

set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_root"

if command -v lsof >/dev/null 2>&1; then
  if lsof -nP -iTCP:8000 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port 8000 is already in use. Stop the existing finance-tracker server first." >&2
    exit 1
  fi
  if lsof -nP -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port 5173 is already in use. Stop the existing Vite server first." >&2
    exit 1
  fi
fi

.venv/bin/python examples/build_demo.py --force
.venv/bin/finance-tracker web --db-path demo.sqlite3 --reload &
api_pid=$!

cleanup() {
  kill "$api_pid" 2>/dev/null || true
  wait "$api_pid" 2>/dev/null || true
}

trap cleanup EXIT HUP INT TERM
npm run dev

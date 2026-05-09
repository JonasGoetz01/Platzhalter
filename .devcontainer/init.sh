#!/usr/bin/env bash
# Post-create setup for the devcontainer.
# Runs once after the container is created.
set -e

WORKSPACE=/workspace

echo "==> Installing frontend dependencies..."
cd "$WORKSPACE/frontend" && bun install

echo "==> Downloading Go module dependencies..."
cd "$WORKSPACE/backend" && go mod download

echo "==> Running database migrations..."
migrate -path "$WORKSPACE/backend/migrations" \
  -database "${DATABASE_URL}" up \
  && echo "    Migrations applied." \
  || echo "    Note: migrations already up-to-date or nothing to apply."

echo ""
echo "Dev container ready. Start your services:"
echo "  Backend:  cd /workspace/backend && air"
echo "  Frontend: cd /workspace/frontend && bun run dev"

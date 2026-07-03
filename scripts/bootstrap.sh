#!/usr/bin/env bash
# Tulip bootstrap — fresh clone to running dev environment.
set -euo pipefail

echo "🌷 Tulip bootstrap"

command -v pnpm >/dev/null 2>&1 || { echo "pnpm required: npm i -g pnpm@9"; exit 1; }
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)' \
  || { echo "Node >=20 required (see .nvmrc)"; exit 1; }

echo "→ installing deps"
pnpm install

if [ ! -f .env ]; then
  echo "→ creating .env from .env.example (fill in your keys)"
  cp .env.example .env
fi

echo "→ generating Prisma client"
pnpm db:generate

echo "→ running core engine tests"
pnpm --filter @tulip/core test

cat <<'NEXT'

✅ Bootstrap complete.

Next:
  1. Edit .env  → set DATABASE_URL (Railway), PLAID_*, ANTHROPIC_API_KEY
  2. pnpm db:migrate   # create schema on Railway Postgres
  3. pnpm db:seed      # demo user
  4. pnpm dev          # web :3000  ·  api :4000

Then open CLAUDE.md and start Phase 1.
NEXT

# 🌷 Tulip

**Grow wealth wisely. Know what you have. Plan where it grows.**

Tulip is a financial wealth management platform that answers the one question competitors don't:
**"What do I do with my next dollar — and what does that cost me across everything else I'm trying to do?"**

Every other app (Monarch, Copilot, YNAB, Empower) reports the past. Tulip prescribes the next move
and prices it against every goal at once.

## The 20% that isn't a competitor

1. **Marginal Dollar Router** — ranks where your next $100/$500/$1,000 produces the most value (401k match → high-interest debt → HSA → …) and shows the dollar impact.
2. **Debt Freedom Engine** — student-loan (IDR/PSLF/refi-aware) and mortgage payoff modeling, avalanche vs snowball with the true cost of each choice, and a live **Debt-Free Date**.
3. **Goal Conflict Resolver** — models competing goals sharing the same dollars and shows the tradeoff frontier.
4. **Reallocation Engine** — sweeps real budget surpluses toward goals and moves your debt-free date in real time.
5. **Property Deal Analyzer** — cap rate, cash-on-cash, DSCR, cashflow, plus net-worth/goal impact.
6. **Financial Health Score** — one 0–100 wealth-health number with transparent drivers.

## Architecture

- **Monorepo:** pnpm + Turborepo
- **Web:** Next.js (`apps/web`)
- **API:** Fastify (`apps/api`)
- **DB:** Prisma + Postgres on Railway (`packages/db`)
- **Engines:** pure, deterministic, integer-cents (`packages/core`)
- **AI advisor:** Flint / Anthropic (`packages/ai`)
- **Aggregation:** Plaid · **Property data:** ATTOM/Zillow

### Locked invariants (do not "fix")

- All money is **integer cents** (`BigInt` in DB, branded `Cents` in core). No floats. No `Decimal` for money.
- Multi-row money mutations run inside a **single `prisma.$transaction()`**.
- Engines in `packages/core` are **pure and injectable** — no I/O, no DB, no LLM.
- **The LLM never does arithmetic.** Core computes; Flint narrates.
- APR stored as **basis points** (integer) in the DB.

## Workspace layout

```
tulip/
├── apps/
│   ├── web/            Next.js front end
│   └── api/            Fastify API
├── packages/
│   ├── core/           deterministic financial engines (+ tests)
│   ├── db/             Prisma schema, client, seed
│   ├── ai/             Flint advisor layer
│   └── config/         shared tsconfig
├── CLAUDE.md           phase-by-phase build roadmap (paste into Claude Code)
└── scripts/bootstrap.sh
```

## Quick start

```bash
pnpm install
cp .env.example .env          # fill in DATABASE_URL, PLAID, ANTHROPIC keys
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev                      # web :3000, api :4000
```

## Prove it works (the POC slice)

```bash
pnpm --filter @tulip/core test          # 7 passing: money + payoff engines
curl -s localhost:4000/debt/compare -X POST -H 'content-type: application/json' \
  -d '{"loans":[{"id":"cc","name":"Visa","balanceDollars":5000,"aprAnnual":0.2299,"minPaymentDollars":100}],"extraMonthlyDollars":300}'
```

## Build order

Open `CLAUDE.md` and work top to bottom. **Do Phase 0 → 1 → 2 first.** A POC that's only
aggregation + net worth is a Monarch clone and proves nothing. The debt engine is the proof.

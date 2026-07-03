# CLAUDE.md — Tulip Build Roadmap

This file is the source of truth for building Tulip with Claude Code. Work phases **in order**.
Do not skip ahead. Do not violate the locked invariants. Commit at the end of every phase.

---

## Prime directives (never violate)

1. **Money is integer cents.** `BigInt` in Postgres, branded `Cents` in `@tulip/core`. No floats, no `Decimal` for money. Parse/format only at the edges (`fromDollars`/`formatUSD`).
2. **APR is stored as basis points** (integer). 7.80% => `780`. Convert to decimal only inside engines.
3. **Every multi-row money mutation runs in a single `prisma.$transaction()`.** No partial writes.
4. **`@tulip/core` is pure.** No DB, no network, no `Date.now()` inside math (inject dates). It must stay unit-testable in isolation.
5. **The LLM never does arithmetic.** `@tulip/core` computes every number; `@tulip/ai` (Flint) only narrates already-computed results and answers NL questions over structured context.
6. **Auditable over impressive.** Every engine function has unit tests with hand-checked expected values before it's wired to a route or UI.
7. **Validate every request body with Zod** at the API boundary.

---

## Phase 0 — Foundation (DONE in scaffold; verify, don't rebuild)

Already scaffolded and passing. Your job in Phase 0 is to verify, wire env, and get the DB live.

- [ ] `pnpm install` at root succeeds.
- [ ] `pnpm --filter @tulip/core test` → 7 passing (money + payoff).
- [ ] Fill `.env` from `.env.example` (Railway `DATABASE_URL` first).
- [ ] `pnpm db:generate && pnpm db:migrate` creates the schema on Railway Postgres.
- [ ] `pnpm db:seed` inserts the demo user.
- [ ] `pnpm dev` boots web (:3000) and api (:4000); `curl localhost:4000/health` → ok.

**Exit criteria:** schema live on Railway, core tests green, both apps boot.
**Commit:** `chore: phase 0 foundation verified`

---

## Phase 1 — Aggregation + Net Worth ("the holistic view" — table stakes)

Goal: connect real accounts and render a net-worth dashboard. This is table stakes; keep it lean.

- [ ] **Auth** (`apps/api/src/routes/auth.ts`): register/login with `bcryptjs` cost 12, `@fastify/jwt` 24h tokens. Add an `authenticate` preHandler; protect all data routes.
- [ ] **Plaid link** (`apps/api/src/plugins/plaid.ts`): `/plaid/link-token` (create) and `/plaid/exchange` (public_token → access_token). **Encrypt the Plaid access token at rest** (AES-GCM, key from env). Never store it plaintext, never in the `Account` table.
- [ ] **Account sync** (`/accounts/sync`): pull balances + transactions, upsert `Account` and `Transaction` by `plaidAccountId` / `plaidTxnId`. Store balances as `BigInt` cents.
- [ ] **Net worth** (`/networth`): `sum(asset balances) - sum(liability balances)` in a single query; return integer cents + a trailing time series. Assets = CHECKING/SAVINGS/INVESTMENT/RETIREMENT/CASH + property equity; liabilities = CREDIT_CARD/LOAN + `Debt` balances + mortgage balances.
- [ ] **Web dashboard** (`apps/web/app/dashboard`): net-worth headline, account list grouped by type, 30/90/365-day trend. Dark-navy brand.
- [ ] Transaction categorization: start with Plaid categories; add a `category` override.

**Watch:** Plaid billing is per-item — this is the main recurring cost. Use `sandbox` env until the POC demo.
**Exit criteria:** link a sandbox bank, see accounts + transactions + a correct net-worth number.
**Commit:** `feat: phase 1 aggregation + net worth`

---

## Phase 2 — Debt Freedom Engine (THE POC PROOF — build this early)

This is the feature that makes Tulip a different category. The `@tulip/core` engines already exist
(`amortize`, `planPayoff`, `compareStrategies`) and are tested. This phase deepens them and ships the UI.

### 2a. Core deepening (`packages/core`)
- [ ] **Mortgage module** (`debt/mortgage.ts`): extra-principal simulation, biweekly-payment simulation, recast vs refinance vs extra-payment comparison. Return interest-saved and payoff-date acceleration. Unit-test against a hand-computed 30y example.
- [ ] **Student-loan module** (`debt/student-loan.ts`): finish the stubs.
  - IDR monthly payment from AGI, family size, and federal poverty guideline (SAVE/IBR/PAYE formulas). Inject the poverty table; don't hardcode a single year.
  - **PSLF**: track qualifying payments toward 120; project forgiveness date.
  - **Forgiveness tax-bomb**: project taxable forgiven balance at term end for IDR (non-PSLF).
  - **Refi break-even** vs. lost federal benefits. Engine MUST flag `refiForfeitsFederalBenefits` before any refi suggestion.
  - Unit tests for each with hand-checked values.

### 2b. API
- [ ] `/debt` CRUD (create/list/update/delete debts; APR in bps).
- [ ] `/debt/compare` already exists — extend to read the user's real debts from DB instead of request body, behind auth.
- [ ] `/debt/plan` → full `planPayoff` result incl. `payoffOrder` and monthly schedule.
- [ ] `/debt/mortgage/simulate` → extra-payment / biweekly / recast / refi outcomes.

### 2c. Web
- [ ] **Debt-Free Date** as the hero number, prominent, recomputes live as the user changes extra payment.
- [ ] Avalanche vs snowball **side-by-side** showing the real dollar + month cost of choosing snowball.
- [ ] Per-loan payoff order timeline.
- [ ] Student-loan detail view with IDR/PSLF/refi guardrails surfaced.

**Exit criteria:** a user with real debts sees a live Debt-Free Date and an honest avalanche/snowball tradeoff. This is the demo you show your friend.
**Commit:** `feat: phase 2 debt freedom engine`

---

## Phase 3 — Goals + Marginal Dollar Router

### 3a. Marginal Dollar Router (`packages/core/router`)
- [ ] Finish `routeMarginalDollar`: tax-adjust returns (401k match = pre-tax + employer %, mortgage interest deductibility lowers effective rate, Roth vs traditional), respect a liquidity floor before investing, rank and split by effective return. **401k match is always #1 while capacity remains.**
- [ ] Unit tests: match-before-debt, high-interest-debt-before-market, capacity filling, liquidity floor honored.

### 3b. Goal Conflict Resolver (`packages/core/goals`)
- [ ] Finish `resolveGoalConflict`: given goals + a monthly surplus, generate the tradeoff frontier (accelerate A / balance / accelerate B). Recompute every projected date per allocation. Use `allocate()` for penny-exact splits.
- [ ] Unit tests: two competing goals, verify dates move correctly as allocation shifts.

### 3c. API + Web
- [ ] `/goals` CRUD; `/router/next-dollar?amount=` returns ranked routing; `/goals/resolve` returns scenarios.
- [ ] Web: goal cards (tulip color by type), a **next-dollar** recommendation panel, and a slider that recomputes goal dates live.

**Exit criteria:** enter "$500 spare" and get a ranked, dollar-quantified recommendation; slide allocation between the rental goal and loan payoff and watch both dates move.
**Commit:** `feat: phase 3 goals + marginal dollar router`

---

## Phase 4 — Budgeting + Reallocation Engine

- [ ] `/budgets` CRUD (monthly limit per category, `BigInt` cents).
- [ ] Month-to-date spend per category from `Transaction` rows; compute over/under vs limit.
- [ ] **Reallocation** (`packages/core`): detect surplus (under-budget categories), propose a sweep to the top-ranked goal/debt via the router, and compute the debt-free-date delta. Pure function; unit-tested.
- [ ] `/reallocate/suggest` and `/reallocate/apply` (apply writes a goal contribution inside a `$transaction`).
- [ ] Web: budget view with over/under bars; a "sweep $X → [goal], moves your debt-free date up N weeks — accept?" one-tap card.

**Exit criteria:** an under-budget month surfaces a concrete sweep suggestion that visibly moves the debt-free date.
**Commit:** `feat: phase 4 budgeting + reallocation`

---

## Phase 5 — Property Module + Financial Health Score

### 5a. Property (`packages/core/property`)
- [ ] Finish `analyzeDeal`: cap rate, cash-on-cash, DSCR, monthly cashflow — using the amortization engine for the mortgage leg. Unit-test with a known deal.
- [ ] Owned-property: equity tracking; sell vs hold vs cash-out-refi modeling.
- [ ] Show how a prospective purchase reshapes net worth and shifts other goal dates.
- [ ] API `/property` CRUD + `/property/analyze`. ATTOM/Zillow value pull for owned property.

### 5b. Financial Health Score (`packages/core/health`)
- [ ] Finish `computeHealthScore`: liquidity (emergency-fund months), rate-weighted debt burden, savings rate, net-worth trajectory. Define banding (0–100) and per-driver breakdown. Unit-test the boundaries.
- [ ] API `/health/score`; Web: a credit-score-style dial with driver breakdown that moves as the user acts.

**Exit criteria:** a single wealth-health number with transparent drivers, plus a working rental deal analyzer.
**Commit:** `feat: phase 5 property + health score`

---

## Phase 6 — Flint (AI advisor layer over everything)

- [ ] Wire `@tulip/ai` to the Anthropic SDK (`FLINT_MODEL=claude-sonnet-4-6`).
- [ ] `explain(recommendation)`: take a **structured engine output** and produce a plain-language explanation. The numbers come from `@tulip/core` — Flint restates, never recomputes.
- [ ] `ask(question, context)`: answer NL questions ("why pay the card before the loan?") using the user's already-computed financial context as grounding. No arithmetic in the model.
- [ ] Guardrail tests: assert Flint responses never introduce numbers absent from the engine output.
- [ ] Web: a chat panel on the dashboard; every AI claim links back to the engine result that produced it.

**Exit criteria:** ask "where should my next $500 go and why?" → Flint narrates the router's exact output.
**Commit:** `feat: phase 6 flint advisor`

---

## Phase 7+ — Beyond POC

- [ ] Household sharing (multi-user, shared goals/budgets).
- [ ] Advisor side (client roster, view-only client dashboards) — only after consumer is solid.
- [ ] Notifications / proactive triggers ("you're under budget — sweep it?").
- [ ] Mobile.

---

## Testing standard (applies every phase)

- Engine functions: `vitest` unit tests with hand-checked expected values, committed **with** the function.
- API routes: Zod-validated inputs; test happy path + one bad-input path.
- Never merge an engine change with a red or missing test.

## Definition of done, per phase

Tests green · typecheck clean (`pnpm typecheck`) · manual exit-criteria met · committed with the message above.

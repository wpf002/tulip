import { type Cents, cents, mulRate, sub, ZERO } from '../money/index.js';

export type OpportunityKind =
  | 'EMPLOYER_401K_MATCH'
  | 'HIGH_INTEREST_DEBT'
  | 'HSA'
  | 'EMERGENCY_FUND'
  | 'MORTGAGE_PREPAY'
  | 'RETIREMENT'
  | 'TAXABLE_INVESTMENT'
  | 'GOAL_FUND';

export interface Opportunity {
  kind: OpportunityKind;
  label: string;
  /** Effective annual return as a decimal, already tax-adjusted. Debt payoff = its APR. */
  effectiveReturn: number;
  /** How much more this opportunity can absorb (remaining match, debt balance, EF gap…). */
  capacity: Cents;
  targetId?: string;
}

export interface RoutedDollar {
  opportunity: Opportunity;
  amount: Cents;
  projectedAnnualValue: Cents;
  rationale: string;
}

/**
 * Ranking tiers. LOCKED ordering rules:
 *  0 — employer match: always #1 while capacity remains (an instant matchRate% return
 *      no market can beat).
 *  1 — emergency fund below its floor: liquidity is funded before any investing.
 *  2 — everything else, by tax-adjusted effective return, descending.
 */
function tier(kind: OpportunityKind): number {
  if (kind === 'EMPLOYER_401K_MATCH') return 0;
  if (kind === 'EMERGENCY_FUND') return 1;
  return 2;
}

/**
 * Rank where the next `amount` produces the most value and split it across
 * opportunities until each is capacity-filled. Pure + deterministic.
 * The LLM (Flint) never does this math — it only narrates the output.
 */
export function routeMarginalDollar(amount: Cents, opportunities: Opportunity[]): RoutedDollar[] {
  const ranked = [...opportunities].sort(
    (a, b) => tier(a.kind) - tier(b.kind) || b.effectiveReturn - a.effectiveReturn,
  );
  const out: RoutedDollar[] = [];
  let left = amount;
  for (const opp of ranked) {
    if (left <= 0) break;
    const put = cents(Math.min(left, opp.capacity));
    if (put <= 0) continue;
    out.push({
      opportunity: opp,
      amount: put,
      projectedAnnualValue: mulRate(put, opp.effectiveReturn),
      rationale:
        opp.kind === 'EMPLOYER_401K_MATCH'
          ? `Free money: ${(opp.effectiveReturn * 100).toFixed(1)}% effective return via ${opp.label}`
          : opp.kind === 'EMERGENCY_FUND'
            ? `Liquidity floor first: ${opp.label}`
            : `${(opp.effectiveReturn * 100).toFixed(1)}% effective return via ${opp.label}`,
    });
    left = sub(left, put);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Building tax-adjusted opportunities from a user profile
// ---------------------------------------------------------------------------

export interface RouterDebtInput {
  id: string;
  name: string;
  aprAnnual: number;
  balance: Cents;
  /** Mortgage interest may be deductible — lowers the effective rate. */
  isMortgage?: boolean;
  interestDeductible?: boolean;
}

export interface RouterProfile {
  /** Marginal income-tax rate as a decimal (0.24 = 24%). */
  marginalTaxRate: number;
  /** Injected expected long-run market return (e.g. 0.07). Never computed by an LLM. */
  expectedMarketReturn: number;
  employerMatch?: {
    /** Employer matches this fraction of each contributed dollar (0.5 = 50¢/$). */
    matchRate: number;
    remainingMatchableContribution: Cents;
  };
  debts: RouterDebtInput[];
  emergencyFund?: {
    current: Cents;
    /** The liquidity floor — fund to here before investing. */
    floor: Cents;
    savingsApr: number;
  };
  retirement?: {
    kind: 'ROTH' | 'TRADITIONAL';
    label: string;
    remainingCapacity: Cents;
  };
  taxableInvesting?: boolean;
}

/**
 * Convert a profile into tax-adjusted opportunities:
 * - employer match: matchRate (instant) + market growth, pre-tax
 * - debt payoff: guaranteed return = APR; deductible mortgage interest
 *   drops it to APR × (1 − marginal rate)
 * - traditional retirement: market + year-one deduction value (marginal rate);
 *   Roth: market (tax-free growth, no deduction today)
 * - emergency fund: capacity = gap to the floor, at the savings APR
 */
export function buildOpportunities(profile: RouterProfile): Opportunity[] {
  const out: Opportunity[] = [];

  if (profile.employerMatch && profile.employerMatch.remainingMatchableContribution > 0) {
    out.push({
      kind: 'EMPLOYER_401K_MATCH',
      label: `401(k) employer match (${(profile.employerMatch.matchRate * 100).toFixed(0)}¢ per $1)`,
      effectiveReturn: profile.employerMatch.matchRate + profile.expectedMarketReturn,
      capacity: profile.employerMatch.remainingMatchableContribution,
    });
  }

  if (profile.emergencyFund) {
    const gap = profile.emergencyFund.floor - profile.emergencyFund.current;
    if (gap > 0) {
      out.push({
        kind: 'EMERGENCY_FUND',
        label: 'Emergency fund to its floor',
        effectiveReturn: profile.emergencyFund.savingsApr,
        capacity: cents(gap),
      });
    }
  }

  for (const d of profile.debts) {
    if (d.balance <= 0) continue;
    const deductible = Boolean(d.isMortgage && d.interestDeductible);
    const effectiveReturn = deductible ? d.aprAnnual * (1 - profile.marginalTaxRate) : d.aprAnnual;
    out.push({
      kind: d.isMortgage ? 'MORTGAGE_PREPAY' : 'HIGH_INTEREST_DEBT',
      label: deductible ? `Pay down ${d.name} (interest deductible)` : `Pay down ${d.name}`,
      effectiveReturn,
      capacity: d.balance,
      targetId: d.id,
    });
  }

  if (profile.retirement && profile.retirement.remainingCapacity > 0) {
    const traditional = profile.retirement.kind === 'TRADITIONAL';
    out.push({
      kind: 'RETIREMENT',
      label: profile.retirement.label,
      effectiveReturn: traditional
        ? profile.expectedMarketReturn + profile.marginalTaxRate // year-one deduction value
        : profile.expectedMarketReturn,
      capacity: profile.retirement.remainingCapacity,
    });
  }

  if (profile.taxableInvesting) {
    out.push({
      kind: 'TAXABLE_INVESTMENT',
      label: 'Taxable brokerage (index funds)',
      effectiveReturn: profile.expectedMarketReturn,
      capacity: cents(Number.MAX_SAFE_INTEGER),
    });
  }

  return out;
}

/** One call: profile → tax-adjusted opportunities → routed dollars. */
export function routeNextDollar(amount: Cents, profile: RouterProfile): RoutedDollar[] {
  return routeMarginalDollar(amount, buildOpportunities(profile));
}

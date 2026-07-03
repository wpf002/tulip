import { type Cents, mulRate } from '../money/index.js';

export type OpportunityKind =
  | 'EMPLOYER_401K_MATCH'
  | 'HIGH_INTEREST_DEBT'
  | 'HSA'
  | 'EMERGENCY_FUND'
  | 'MORTGAGE_PREPAY'
  | 'TAXABLE_INVESTMENT'
  | 'GOAL_FUND';

export interface Opportunity {
  kind: OpportunityKind;
  label: string;
  /** Effective guaranteed/expected annual return as a decimal. Debt payoff = its APR. */
  effectiveReturn: number;
  /** How much more money this opportunity can still absorb (e.g. remaining match, debt balance). */
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
 * Rank where the next `amount` produces the most value and split it across opportunities
 * by effective return until each is capacity-filled. Pure + deterministic.
 * The LLM (Flint) never does this math — it only narrates the output.
 *
 * ROADMAP (Phase 3): tax-adjust returns (match=pre-tax, mortgage=deductible,
 * Roth vs traditional), risk-adjust expected market returns, respect liquidity floors.
 */
export function routeMarginalDollar(amount: Cents, opportunities: Opportunity[]): RoutedDollar[] {
  const ranked = [...opportunities].sort((a, b) => b.effectiveReturn - a.effectiveReturn);
  const out: RoutedDollar[] = [];
  let left = amount;
  for (const opp of ranked) {
    if (left <= 0) break;
    const put = Math.min(left, opp.capacity) as Cents;
    if (put <= 0) continue;
    out.push({
      opportunity: opp,
      amount: put,
      projectedAnnualValue: mulRate(put, opp.effectiveReturn),
      rationale: `${(opp.effectiveReturn * 100).toFixed(1)}% effective return via ${opp.label}`,
    });
    left = (left - put) as Cents;
  }
  return out;
}

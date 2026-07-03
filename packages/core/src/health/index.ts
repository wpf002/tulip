import { type Cents } from '../money/index.js';

export interface HealthInputs {
  liquidCents: Cents;
  monthlyExpensesCents: Cents;
  monthlyIncomeCents: Cents;
  monthlySavingsCents: Cents;
  totalDebtCents: Cents;
  /** rate-weighted so a $10k balance at 24% hurts more than $10k at 3%. */
  weightedDebtRate: number;
  netWorthTrendCents: Cents; // change over trailing window
}

export interface HealthScore {
  score: number; // 0..100
  subscores: {
    liquidity: number;
    debtBurden: number;
    savingsRate: number;
    netWorthTrajectory: number;
  };
}

/**
 * A single 0-100 wealth-health number with transparent drivers.
 * ROADMAP (Phase 5): finalize weightings + banding; expose per-driver explanations to Flint.
 */
export function computeHealthScore(_inputs: HealthInputs): HealthScore {
  // Implemented in Phase 5 against the spec in CLAUDE.md.
  return {
    score: 0,
    subscores: { liquidity: 0, debtBurden: 0, savingsRate: 0, netWorthTrajectory: 0 },
  };
}

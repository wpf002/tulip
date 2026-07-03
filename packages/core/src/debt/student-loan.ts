import { type Cents } from '../money/index.js';
import { type Loan } from './amortization.js';

export type FederalPlan = 'STANDARD' | 'SAVE' | 'IBR' | 'PAYE' | 'ICR';

export interface StudentLoan extends Loan {
  loanType: 'FEDERAL' | 'PRIVATE';
  subsidized?: boolean;
  servicer?: string;
  /** For PSLF tracking: qualifying payments already made toward 120. */
  pslfPaymentsMade?: number;
}

/**
 * PSLF progress toward the 120 qualifying payments.
 * ROADMAP (Phase 2): full IDR payment calc from AGI + family size + poverty line;
 * forgiveness tax-bomb projection; refi break-even vs. lost forgiveness.
 */
export function pslfProgress(loan: StudentLoan): { made: number; remaining: number; pct: number } {
  const made = loan.pslfPaymentsMade ?? 0;
  const remaining = Math.max(0, 120 - made);
  return { made, remaining, pct: Math.min(1, made / 120) };
}

/**
 * Guardrail: refinancing federal -> private forfeits IDR + PSLF + forbearance protections.
 * The engine must surface this BEFORE any refi recommendation.
 */
export function refiForfeitsFederalBenefits(loan: StudentLoan): boolean {
  return loan.loanType === 'FEDERAL';
}

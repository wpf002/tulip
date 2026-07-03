import { type Cents } from '../money/index.js';

export interface DealInputs {
  purchasePrice: Cents;
  downPayment: Cents;
  aprAnnual: number;
  termMonths: number;
  monthlyRent: Cents;
  monthlyExpenses: Cents; // taxes, insurance, mgmt, maintenance reserve
}

export interface DealMetrics {
  capRate: number;
  cashOnCash: number;
  dscr: number;
  monthlyCashflow: Cents;
}

/**
 * Rental deal analyzer: cap rate, cash-on-cash, DSCR, monthly cashflow.
 * ROADMAP (Phase 5): implement against amortization engine; feed result into goal + net-worth impact.
 */
export function analyzeDeal(_inputs: DealInputs): DealMetrics {
  return { capRate: 0, cashOnCash: 0, dscr: 0, monthlyCashflow: 0 as Cents };
}

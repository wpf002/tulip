import { type Cents, cents, add, sub, ZERO } from '../money/index.js';
import { amortize, type AmortizationResult, type Loan } from './amortization.js';

/**
 * Mortgage engine. Pure — dates are injected, money is integer cents.
 * Computed payments round UP to the next cent so the loan is guaranteed to
 * clear within its term (the final payment shrinks to compensate). This can
 * differ from a lender's half-up-rounded payment by one cent.
 */

export interface Mortgage {
  balance: Cents;
  /** Annual rate as a decimal (0.06 = 6%). */
  aprAnnual: number;
  remainingTermMonths: number;
  /** Actual contractual payment (principal + interest only). Computed if omitted. */
  monthlyPayment?: Cents;
}

export interface MortgageOutcome {
  months: number;
  payoffDate: string; // ISO yyyy-mm-dd
  totalInterest: Cents;
  totalPaid: Cents;
}

export interface MortgageSimulation {
  baseline: MortgageOutcome;
  alternative: MortgageOutcome;
  interestSaved: Cents;
  monthsSaved: number;
}

/** Standard annuity payment for `principal` at `aprAnnual` over `termMonths`, rounded up. */
export function mortgagePayment(principal: Cents, aprAnnual: number, termMonths: number): Cents {
  if (termMonths <= 0) throw new Error('termMonths must be positive');
  if (aprAnnual === 0) return cents(Math.ceil(principal / termMonths));
  const r = aprAnnual / 12;
  const raw = (principal * r) / (1 - Math.pow(1 + r, -termMonths));
  return cents(Math.ceil(raw));
}

function toLoan(m: Mortgage): Loan {
  return {
    id: 'mortgage',
    name: 'mortgage',
    balance: m.balance,
    aprAnnual: m.aprAnnual,
    minPayment: scheduledPayment(m),
  };
}

export function scheduledPayment(m: Mortgage): Cents {
  return m.monthlyPayment ?? mortgagePayment(m.balance, m.aprAnnual, m.remainingTermMonths);
}

function addMonths(startDate: Date, months: number): string {
  const d = new Date(startDate.getFullYear(), startDate.getMonth() + months, startDate.getDate());
  return d.toISOString().slice(0, 10);
}

function outcome(result: AmortizationResult, startDate: Date): MortgageOutcome {
  return {
    months: result.months,
    payoffDate: addMonths(startDate, result.months),
    totalInterest: result.totalInterest,
    totalPaid: result.totalPaid,
  };
}

function simulate(m: Mortgage, alternativePayment: Cents, startDate: Date): MortgageSimulation {
  const base = amortize(toLoan(m), scheduledPayment(m));
  const alt = amortize(toLoan(m), alternativePayment);
  return {
    baseline: outcome(base, startDate),
    alternative: outcome(alt, startDate),
    interestSaved: sub(base.totalInterest, alt.totalInterest),
    monthsSaved: base.months - alt.months,
  };
}

/** Pay `extraMonthly` toward principal every month on top of the scheduled payment. */
export function simulateExtraPrincipal(
  m: Mortgage,
  extraMonthly: Cents,
  startDate: Date,
): MortgageSimulation {
  return simulate(m, add(scheduledPayment(m), extraMonthly), startDate);
}

/**
 * Biweekly payments: half the monthly payment every two weeks = 26 half-payments,
 * i.e. 13 full payments a year. Modeled monthly as payment × 13/12 (the standard
 * equivalence), rounded half-up.
 */
export function simulateBiweekly(m: Mortgage, startDate: Date): MortgageSimulation {
  const p = scheduledPayment(m);
  const effective = cents(Math.round((p * 13) / 12));
  return simulate(m, effective, startDate);
}

export interface RecastResult {
  /** New (lower) payment after the lump sum, re-amortized over the same remaining term. */
  newPayment: Cents;
  oldPayment: Cents;
  monthlyRelief: Cents;
  outcome: MortgageOutcome;
  /** Interest saved vs. keeping the original schedule with no lump sum. */
  interestSaved: Cents;
}

/** Recast: apply a lump sum, keep rate and term, re-amortize to a lower payment. */
export function simulateRecast(m: Mortgage, lumpSum: Cents, startDate: Date): RecastResult {
  if (lumpSum >= m.balance) throw new Error('Lump sum must be smaller than the balance');
  const oldPayment = scheduledPayment(m);
  const newBalance = sub(m.balance, lumpSum);
  const newPayment = mortgagePayment(newBalance, m.aprAnnual, m.remainingTermMonths);
  const base = amortize(toLoan(m), oldPayment);
  const recast = amortize(
    { id: 'recast', name: 'recast', balance: newBalance, aprAnnual: m.aprAnnual, minPayment: newPayment },
    newPayment,
  );
  return {
    newPayment,
    oldPayment,
    monthlyRelief: sub(oldPayment, newPayment),
    outcome: outcome(recast, startDate),
    interestSaved: sub(base.totalInterest, recast.totalInterest),
  };
}

export interface RefinanceOffer {
  newAprAnnual: number;
  newTermMonths: number;
  closingCosts: Cents;
}

export interface RefinanceResult {
  newPayment: Cents;
  oldPayment: Cents;
  monthlySavings: Cents; // negative if the new payment is higher
  /** Months for accumulated monthly savings to cover closing costs; null if payment doesn't drop. */
  breakEvenMonths: number | null;
  outcome: MortgageOutcome;
  /** Interest saved vs. baseline, NET of closing costs. */
  netSavings: Cents;
}

/** Refinance the current balance into a new rate/term, paying closing costs. */
export function simulateRefinance(m: Mortgage, offer: RefinanceOffer, startDate: Date): RefinanceResult {
  const oldPayment = scheduledPayment(m);
  const newPayment = mortgagePayment(m.balance, offer.newAprAnnual, offer.newTermMonths);
  const base = amortize(toLoan(m), oldPayment);
  const refi = amortize(
    { id: 'refi', name: 'refi', balance: m.balance, aprAnnual: offer.newAprAnnual, minPayment: newPayment },
    newPayment,
  );
  const monthlySavings = sub(oldPayment, newPayment);
  return {
    newPayment,
    oldPayment,
    monthlySavings,
    breakEvenMonths:
      monthlySavings > 0 ? Math.ceil(offer.closingCosts / monthlySavings) : null,
    outcome: outcome(refi, startDate),
    netSavings: sub(sub(base.totalInterest, refi.totalInterest), offer.closingCosts),
  };
}

export interface MortgageComparison {
  baseline: MortgageOutcome;
  extraPayment?: MortgageSimulation;
  biweekly: MortgageSimulation;
  recast?: RecastResult;
  refinance?: RefinanceResult;
}

/** One call for the UI: every strategy the user could take, side by side. */
export function compareMortgageMoves(
  m: Mortgage,
  options: { extraMonthly?: Cents; lumpSum?: Cents; refi?: RefinanceOffer },
  startDate: Date,
): MortgageComparison {
  const base = amortize(toLoan(m), scheduledPayment(m));
  const result: MortgageComparison = {
    baseline: outcome(base, startDate),
    biweekly: simulateBiweekly(m, startDate),
  };
  if (options.extraMonthly && options.extraMonthly > 0) {
    result.extraPayment = simulateExtraPrincipal(m, options.extraMonthly, startDate);
  }
  if (options.lumpSum && options.lumpSum > 0 && options.lumpSum < m.balance) {
    result.recast = simulateRecast(m, options.lumpSum, startDate);
  }
  if (options.refi) {
    result.refinance = simulateRefinance(m, options.refi, startDate);
  }
  return result;
}

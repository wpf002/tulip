import { type Cents, cents, add, sub, min, ZERO, isPositive, mulRate } from '../money/index.js';
import { type Loan, monthlyInterest, amortize } from './amortization.js';
import { mortgagePayment } from './mortgage.js';

export type FederalPlan = 'STANDARD' | 'SAVE' | 'IBR' | 'PAYE' | 'ICR';

export interface StudentLoan extends Loan {
  loanType: 'FEDERAL' | 'PRIVATE';
  subsidized?: boolean;
  servicer?: string;
  /** For PSLF tracking: qualifying payments already made toward 120. */
  pslfPaymentsMade?: number;
}

// ---------------------------------------------------------------------------
// Income-driven repayment
// ---------------------------------------------------------------------------

/**
 * HHS poverty guidelines are a base amount plus a per-person increment.
 * Injected — never hardcode a single year's table in the engine.
 * (2024 contiguous US: base $15,060, +$5,380/person.)
 */
export interface PovertyTable {
  baseAnnual: Cents;
  perAdditionalPersonAnnual: Cents;
}

export function povertyGuideline(table: PovertyTable, familySize: number): Cents {
  if (familySize < 1 || !Number.isInteger(familySize)) {
    throw new Error(`familySize must be a positive integer, got ${familySize}`);
  }
  return cents(table.baseAnnual + (familySize - 1) * table.perAdditionalPersonAnnual);
}

export interface IdrInput {
  plan: 'SAVE' | 'PAYE' | 'IBR';
  agiAnnual: Cents;
  familySize: number;
  povertyTable: PovertyTable;
  /** SAVE weights 5% (undergrad) vs 10% (grad) by balance share. 0 = all undergrad. */
  gradShare?: number;
  /** IBR: new borrowers (on/after 2014-07-01) pay 10% capped at standard; else 15%. */
  newBorrower?: boolean;
  /** Loan terms, used for the PAYE/IBR standard-10-year-payment cap. */
  balance: Cents;
  aprAnnual: number;
}

/** The 10-year standard payment — also the statutory cap for PAYE/IBR. */
export function standardTenYearPayment(balance: Cents, aprAnnual: number): Cents {
  return mortgagePayment(balance, aprAnnual, 120);
}

/**
 * Monthly IDR payment. discretionary = max(0, AGI − multiple × poverty guideline);
 * payment = discretionary × rate / 12, floored at $0.
 * Multiples: SAVE 2.25×, PAYE/IBR 1.5×. Rates: SAVE 5–10% by grad share,
 * PAYE 10%, IBR 15% (10% for new borrowers). PAYE/IBR cap at the standard
 * 10-year payment (approximated with the current balance); SAVE has no cap.
 */
export function idrMonthlyPayment(input: IdrInput): Cents {
  const guideline = povertyGuideline(input.povertyTable, input.familySize);

  let multiple: number;
  let rate: number;
  switch (input.plan) {
    case 'SAVE': {
      const gradShare = input.gradShare ?? 0;
      if (gradShare < 0 || gradShare > 1) throw new Error('gradShare must be within [0, 1]');
      multiple = 2.25;
      rate = 0.05 + 0.05 * gradShare;
      break;
    }
    case 'PAYE':
      multiple = 1.5;
      rate = 0.1;
      break;
    case 'IBR':
      multiple = 1.5;
      rate = input.newBorrower ? 0.1 : 0.15;
      break;
  }

  const protectedIncome = mulRate(guideline, multiple);
  if (input.agiAnnual <= protectedIncome) return ZERO;
  const discretionary = sub(input.agiAnnual, protectedIncome);
  const payment = cents(Math.round((discretionary * rate) / 12));

  if (input.plan === 'SAVE') return payment;
  return min(payment, standardTenYearPayment(input.balance, input.aprAnnual));
}

// ---------------------------------------------------------------------------
// PSLF
// ---------------------------------------------------------------------------

export function pslfProgress(loan: StudentLoan): { made: number; remaining: number; pct: number } {
  const made = loan.pslfPaymentsMade ?? 0;
  const remaining = Math.max(0, 120 - made);
  return { made, remaining, pct: Math.min(1, made / 120) };
}

export interface PslfProjection {
  paymentsMade: number;
  paymentsRemaining: number;
  forgivenessDate: string; // ISO yyyy-mm-dd; startDate + remaining months
  /** Simulated balance forgiven at the 120th qualifying payment (tax-free). */
  projectedForgiven: Cents;
  /** Total paid between now and forgiveness. */
  paidUntilForgiveness: Cents;
  alreadyEligible: boolean;
}

function addMonths(startDate: Date, months: number): string {
  const d = new Date(startDate.getFullYear(), startDate.getMonth() + months, startDate.getDate());
  return d.toISOString().slice(0, 10);
}

/**
 * Project the balance forgiven at 120 qualifying PSLF payments, simulating
 * month-by-month accrual at `monthlyPayment` (IDR payments may be below
 * interest — the balance is allowed to grow).
 */
export function projectPslf(
  loan: { balance: Cents; aprAnnual: number },
  monthlyPayment: Cents,
  paymentsMade: number,
  startDate: Date,
): PslfProjection {
  const remaining = Math.max(0, 120 - paymentsMade);
  let balance = loan.balance;
  let paid = ZERO;

  for (let m = 0; m < remaining && isPositive(balance); m++) {
    const owed = add(balance, monthlyInterest(balance, loan.aprAnnual));
    const payment = min(monthlyPayment, owed);
    balance = sub(owed, payment);
    paid = add(paid, payment);
  }

  return {
    paymentsMade,
    paymentsRemaining: remaining,
    forgivenessDate: addMonths(startDate, remaining),
    projectedForgiven: balance,
    paidUntilForgiveness: paid,
    alreadyEligible: remaining === 0,
  };
}

// ---------------------------------------------------------------------------
// IDR forgiveness tax bomb (non-PSLF)
// ---------------------------------------------------------------------------

export interface TaxBombProjection {
  forgivenessDate: string;
  projectedForgiven: Cents;
  /** Estimated federal tax due on the forgiven amount in the forgiveness year. */
  taxBomb: Cents;
}

/**
 * Non-PSLF IDR forgiveness (20/25-year terms) is taxable income under current
 * law. Simulate the balance to term end at `monthlyPayment` and apply the
 * injected marginal tax rate to whatever is forgiven.
 */
export function projectForgivenessTaxBomb(
  loan: { balance: Cents; aprAnnual: number },
  monthlyPayment: Cents,
  monthsUntilForgiveness: number,
  marginalTaxRate: number,
  startDate: Date,
): TaxBombProjection {
  if (marginalTaxRate < 0 || marginalTaxRate > 1) throw new Error('marginalTaxRate must be within [0, 1]');
  let balance = loan.balance;
  for (let m = 0; m < monthsUntilForgiveness && isPositive(balance); m++) {
    const owed = add(balance, monthlyInterest(balance, loan.aprAnnual));
    balance = sub(owed, min(monthlyPayment, owed));
  }
  return {
    forgivenessDate: addMonths(startDate, monthsUntilForgiveness),
    projectedForgiven: balance,
    taxBomb: mulRate(balance, marginalTaxRate),
  };
}

// ---------------------------------------------------------------------------
// Refinance guardrails
// ---------------------------------------------------------------------------

/**
 * Guardrail: refinancing federal -> private forfeits IDR + PSLF + forbearance protections.
 * The engine must surface this BEFORE any refi recommendation.
 */
export function refiForfeitsFederalBenefits(loan: Pick<StudentLoan, 'loanType'>): boolean {
  return loan.loanType === 'FEDERAL';
}

export const FEDERAL_BENEFITS_LOST = [
  'Income-driven repayment (SAVE/IBR/PAYE)',
  'Public Service Loan Forgiveness (PSLF)',
  'IDR forgiveness at 20–25 year term end',
  'Federal deferment and forbearance protections',
  'Potential future federal relief programs',
] as const;

export interface StudentRefiOffer {
  newAprAnnual: number;
  newTermMonths: number;
  fees: Cents;
}

export interface StudentRefiAnalysis {
  /** MUST be surfaced before any refi suggestion. */
  refiForfeitsFederalBenefits: boolean;
  lostBenefits: readonly string[];
  newPayment: Cents;
  oldPayment: Cents;
  monthlySavings: Cents;
  breakEvenMonths: number | null;
  /** Lifetime interest saved vs. staying the course, net of fees. */
  netSavings: Cents;
}

export function analyzeStudentRefi(
  loan: StudentLoan,
  currentPayment: Cents,
  offer: StudentRefiOffer,
): StudentRefiAnalysis {
  const newPayment = mortgagePayment(loan.balance, offer.newAprAnnual, offer.newTermMonths);
  const base = amortize(loan, currentPayment);
  const refi = amortize(
    { id: loan.id, name: `${loan.name} (refi)`, balance: loan.balance, aprAnnual: offer.newAprAnnual, minPayment: newPayment },
    newPayment,
  );
  const monthlySavings = sub(currentPayment, newPayment);
  return {
    refiForfeitsFederalBenefits: refiForfeitsFederalBenefits(loan),
    lostBenefits: refiForfeitsFederalBenefits(loan) ? FEDERAL_BENEFITS_LOST : [],
    newPayment,
    oldPayment: currentPayment,
    monthlySavings,
    breakEvenMonths: monthlySavings > 0 ? Math.ceil(offer.fees / monthlySavings) : null,
    netSavings: sub(sub(base.totalInterest, refi.totalInterest), offer.fees),
  };
}

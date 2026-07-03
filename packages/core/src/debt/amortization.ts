import { type Cents, cents, add, sub, mulRate, min, isPositive, ZERO } from '../money/index.js';

export interface Loan {
  id: string;
  name: string;
  balance: Cents;
  /** Annual interest rate as a decimal, e.g. 0.078 for 7.8% APR. */
  aprAnnual: number;
  /** Scheduled minimum monthly payment. */
  minPayment: Cents;
}

export interface AmortizationRow {
  month: number;
  startingBalance: Cents;
  interest: Cents;
  principal: Cents;
  payment: Cents;
  endingBalance: Cents;
}

export interface AmortizationResult {
  schedule: AmortizationRow[];
  months: number;
  totalInterest: Cents;
  totalPaid: Cents;
}

const MAX_MONTHS = 1200; // 100y guard against non-amortizing inputs

/** Monthly interest = balance * (apr / 12), rounded half-up to whole cents. */
export function monthlyInterest(balance: Cents, aprAnnual: number): Cents {
  return mulRate(balance, aprAnnual / 12);
}

/**
 * Amortize a single loan to payoff given a fixed monthly payment.
 * Deterministic, pure. Throws if the payment can never cover interest.
 */
export function amortize(loan: Loan, monthlyPayment: Cents): AmortizationResult {
  const schedule: AmortizationRow[] = [];
  let balance = loan.balance;
  let totalInterest = ZERO;
  let totalPaid = ZERO;
  let month = 0;

  const firstInterest = monthlyInterest(balance, loan.aprAnnual);
  if (monthlyPayment <= firstInterest && isPositive(balance)) {
    throw new Error(
      `Payment ${monthlyPayment} does not cover monthly interest ${firstInterest} on "${loan.name}". Loan never amortizes.`,
    );
  }

  while (isPositive(balance) && month < MAX_MONTHS) {
    month += 1;
    const startingBalance = balance;
    const interest = monthlyInterest(balance, loan.aprAnnual);
    const owed = add(balance, interest);
    const payment = min(monthlyPayment, owed); // final payment is exact, no overshoot
    const principal = sub(payment, interest);
    balance = sub(balance, principal);
    totalInterest = add(totalInterest, interest);
    totalPaid = add(totalPaid, payment);
    schedule.push({ month, startingBalance, interest, principal, payment, endingBalance: balance });
  }

  return { schedule, months: month, totalInterest, totalPaid };
}

/** Convenience: months-to-payoff and total interest without the full schedule in memory. */
export function payoffSummary(loan: Loan, monthlyPayment: Cents): { months: number; totalInterest: Cents } {
  const { months, totalInterest } = amortize(loan, monthlyPayment);
  return { months, totalInterest };
}

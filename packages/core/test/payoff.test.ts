import { describe, it, expect } from 'vitest';
import { fromDollars } from '../src/money/index.js';
import { type Loan } from '../src/debt/amortization.js';
import { planPayoff, compareStrategies } from '../src/debt/payoff.js';

const loans: Loan[] = [
  { id: 'a', name: 'Credit Card', balance: fromDollars('5000'), aprAnnual: 0.2299, minPayment: fromDollars('100') },
  { id: 'b', name: 'Student Loan', balance: fromDollars('18000'), aprAnnual: 0.078, minPayment: fromDollars('200') },
  { id: 'c', name: 'Car Loan', balance: fromDollars('12000'), aprAnnual: 0.049, minPayment: fromDollars('300') },
];

describe('debt payoff engine', () => {
  it('reaches debt-free in finite time with extra budget', () => {
    const plan = planPayoff(loans, fromDollars('400'), 'avalanche', new Date('2026-01-15'));
    expect(plan.monthsToDebtFree).toBeGreaterThan(0);
    expect(plan.monthsToDebtFree).toBeLessThan(120);
    expect(plan.payoffOrder.length).toBe(3);
    // avalanche clears the 22.99% card first
    expect(plan.payoffOrder[0]!.loanId).toBe('a');
  });

  it('avalanche costs less interest than snowball', () => {
    const cmp = compareStrategies(loans, fromDollars('400'), new Date('2026-01-15'));
    expect(cmp.avalanche.totalInterest).toBeLessThanOrEqual(cmp.snowball.totalInterest);
    expect(cmp.interestDelta).toBeGreaterThanOrEqual(0);
  });

  it('snowball clears the smallest balance first', () => {
    const plan = planPayoff(loans, fromDollars('400'), 'snowball', new Date('2026-01-15'));
    expect(plan.payoffOrder[0]!.loanId).toBe('a'); // 5000 is smallest here too
  });
});

import { describe, expect, it } from 'vitest';
import {
  cents,
  mortgagePayment,
  simulateExtraPrincipal,
  simulateBiweekly,
  simulateRecast,
  simulateRefinance,
  compareMortgageMoves,
  type Mortgage,
} from '../src/index.js';

const START = new Date(2026, 0, 15); // injected — engines never call Date.now()

/**
 * Hand-checked mortgage: $10,000 @ 12% APR (1%/mo), 3-month term.
 * Annuity payment = 10000 × 0.01 × 1.01^3 / (1.01^3 − 1) = $3,400.2211… → ceil $3,400.23.
 * m1: interest $100.00, principal $3,300.23, balance $6,699.77
 * m2: interest  $67.00, principal $3,333.23, balance $3,366.54
 * m3: interest  $33.67, final payment $3,400.21, balance $0
 * total interest = 100.00 + 67.00 + 33.67 = $200.67; total paid $10,200.67
 */
const TINY: Mortgage = { balance: cents(1000000), aprAnnual: 0.12, remainingTermMonths: 3 };

describe('mortgagePayment', () => {
  it('computes the classic 30y example: $300k @ 6% / 360mo → $1,798.66 (ceil of 1,798.6516)', () => {
    expect(mortgagePayment(cents(30000000), 0.06, 360)).toBe(179866);
  });

  it('handles 0% APR as straight division, rounded up', () => {
    expect(mortgagePayment(cents(1200000), 0, 12)).toBe(100000);
  });

  it('hand-checked tiny loan: $10,000 @ 12% / 3mo → $3,400.23', () => {
    expect(mortgagePayment(cents(1000000), 0.12, 3)).toBe(340023);
  });
});

describe('simulateExtraPrincipal', () => {
  it('0% mechanics: $1,200 @ 0%/12mo with +$100/mo halves the payoff time', () => {
    const m: Mortgage = { balance: cents(120000), aprAnnual: 0, remainingTermMonths: 12 };
    const sim = simulateExtraPrincipal(m, cents(10000), START);
    expect(sim.baseline.months).toBe(12);
    expect(sim.alternative.months).toBe(6);
    expect(sim.monthsSaved).toBe(6);
    expect(sim.interestSaved).toBe(0);
  });

  it('hand-checked: tiny loan +$1,000/mo saves $30.10 interest', () => {
    // With $4,400.23/mo: m1 int $100.00 bal $5,699.77; m2 int $57.00 bal $1,356.54;
    // m3 int $13.57, final payment $1,370.11. Total interest $170.57 vs $200.67.
    const sim = simulateExtraPrincipal(TINY, cents(100000), START);
    expect(sim.baseline.totalInterest).toBe(20067);
    expect(sim.baseline.totalPaid).toBe(1020067);
    expect(sim.alternative.totalInterest).toBe(17057);
    expect(sim.interestSaved).toBe(3010);
    expect(sim.baseline.payoffDate).toBe('2026-04-15');
  });

  it('30y sanity: baseline clears in exactly 360 months, interest ≈ $347.5k', () => {
    const m: Mortgage = { balance: cents(30000000), aprAnnual: 0.06, remainingTermMonths: 360 };
    const sim = simulateExtraPrincipal(m, cents(20000), START);
    expect(sim.baseline.months).toBe(360);
    // Bounded: 360 × $1,798.66 − $300,000 = $347,517.60 is the hard ceiling; the
    // final payment gives back at most a few dollars.
    expect(sim.baseline.totalInterest).toBeGreaterThan(34750000);
    expect(sim.baseline.totalInterest).toBeLessThanOrEqual(34751760);
    expect(sim.monthsSaved).toBeGreaterThan(0);
    expect(sim.interestSaved).toBeGreaterThan(0);
  });
});

describe('simulateBiweekly', () => {
  it('hand-checked: tiny loan biweekly ≈ payment × 13/12 saves $8.54', () => {
    // effective = round(340023 × 13/12) = $3,683.58
    // m1 int $100.00 bal $6,416.42... wait: bal = 10,000 + 100 − 3,683.58 = $6,416.42
    // m2 int $64.16 bal $2,797.00; m3 int $27.97, final $2,824.97.
    // total interest = 100.00 + 64.16 + 27.97 = $192.13; saved $8.54
    const sim = simulateBiweekly(TINY, START);
    expect(sim.alternative.totalInterest).toBe(19213);
    expect(sim.interestSaved).toBe(854);
  });

  it('30y: biweekly knocks roughly 5.5 years off ($300k @ 6%/360)', () => {
    // effective payment = round(179866 × 13/12) = $1,948.55
    // closed form: n = −ln(1 − P·r/A)/ln(1.005) ≈ 294.5 → payoff in 294–296 months
    const m: Mortgage = { balance: cents(30000000), aprAnnual: 0.06, remainingTermMonths: 360 };
    const sim = simulateBiweekly(m, START);
    expect(sim.alternative.months).toBeGreaterThanOrEqual(294);
    expect(sim.alternative.months).toBeLessThanOrEqual(296);
    expect(sim.monthsSaved).toBeGreaterThanOrEqual(64);
    expect(sim.interestSaved).toBeGreaterThan(6000000); // > $60k
  });
});

describe('simulateRecast', () => {
  it('hand-checked: $50k lump on $300k @ 6%/360 → new payment $1,498.88', () => {
    // annuity on $250,000: 250e5 × 0.005 / 0.83395811 = 149,887.6 cents → ceil $1,498.88
    const m: Mortgage = { balance: cents(30000000), aprAnnual: 0.06, remainingTermMonths: 360 };
    const r = simulateRecast(m, cents(5000000), START);
    expect(r.oldPayment).toBe(179866);
    expect(r.newPayment).toBe(149888);
    expect(r.monthlyRelief).toBe(29978);
    expect(r.outcome.months).toBe(360); // recast keeps the term
    expect(r.interestSaved).toBeGreaterThan(0);
  });

  it('rejects a lump sum >= balance', () => {
    expect(() => simulateRecast(TINY, cents(1000000), START)).toThrow();
  });
});

describe('simulateRefinance', () => {
  it('hand-checked: $300k @ 6%/360 → 5%/360 with $6k costs breaks even in 32 months', () => {
    // new payment: 30e6 × (0.05/12) / (1 − (1+0.05/12)^−360) = 161,046.3 cents → ceil $1,610.47
    // monthly savings = 1,798.66 − 1,610.47 = $188.19; 6000/188.19 = 31.88 → 32 months
    const m: Mortgage = { balance: cents(30000000), aprAnnual: 0.06, remainingTermMonths: 360 };
    const r = simulateRefinance(m, { newAprAnnual: 0.05, newTermMonths: 360, closingCosts: cents(600000) }, START);
    expect(r.newPayment).toBe(161047);
    expect(r.monthlySavings).toBe(18819);
    expect(r.breakEvenMonths).toBe(32);
    expect(r.netSavings).toBeGreaterThan(0);
  });

  it('returns null break-even when the new payment is not lower', () => {
    const r = simulateRefinance(TINY, { newAprAnnual: 0.2, newTermMonths: 3, closingCosts: cents(10000) }, START);
    expect(r.breakEvenMonths).toBeNull();
  });
});

describe('compareMortgageMoves', () => {
  it('bundles baseline + all requested strategies', () => {
    const m: Mortgage = { balance: cents(30000000), aprAnnual: 0.06, remainingTermMonths: 360 };
    const c = compareMortgageMoves(
      m,
      {
        extraMonthly: cents(20000),
        lumpSum: cents(5000000),
        refi: { newAprAnnual: 0.05, newTermMonths: 360, closingCosts: cents(600000) },
      },
      START,
    );
    expect(c.baseline.months).toBe(360);
    expect(c.extraPayment?.monthsSaved).toBeGreaterThan(0);
    expect(c.biweekly.monthsSaved).toBeGreaterThan(0);
    expect(c.recast?.newPayment).toBe(149888);
    expect(c.refinance?.breakEvenMonths).toBe(32);
  });
});

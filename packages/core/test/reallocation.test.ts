import { describe, expect, it } from 'vitest';
import { cents, detectSurplus, sweepDebtFreeDelta, type Loan } from '../src/index.js';

const START = new Date(2026, 0, 15);

describe('detectSurplus', () => {
  it('hand-checked: under-budget categories sum; over-budget counts as zero', () => {
    const result = detectSurplus([
      { category: 'Groceries', monthlyLimit: cents(60000), spentSoFar: cents(42000) }, // +$180
      { category: 'Dining', monthlyLimit: cents(20000), spentSoFar: cents(26000) }, // over → 0
      { category: 'Gas', monthlyLimit: cents(15000), spentSoFar: cents(15000) }, // exactly on → 0
      { category: 'Fun', monthlyLimit: cents(10000), spentSoFar: cents(2500) }, // +$75
    ]);
    expect(result.total).toBe(25500); // $180 + $75
    expect(result.perCategory).toEqual([
      { category: 'Groceries', surplus: 18000 },
      { category: 'Fun', surplus: 7500 },
    ]);
  });

  it('returns zero for an empty or fully-spent budget set', () => {
    expect(detectSurplus([]).total).toBe(0);
    expect(
      detectSurplus([{ category: 'X', monthlyLimit: cents(100), spentSoFar: cents(100) }]).total,
    ).toBe(0);
  });
});

describe('sweepDebtFreeDelta', () => {
  it('hand-checked 0% loan: $200 sweep on $1,000 at $100/mo saves exactly 2 months', () => {
    const loans: Loan[] = [
      { id: 'l', name: 'Loan', balance: cents(100000), aprAnnual: 0, minPayment: cents(10000) },
    ];
    const delta = sweepDebtFreeDelta(loans, cents(0), cents(20000), 'avalanche', START);
    // baseline: 10 months (2026-11-15); swept $800 → 8 months (2026-09-15)
    expect(delta.baselineDebtFreeDate).toBe('2026-11-15');
    expect(delta.sweptDebtFreeDate).toBe('2026-09-15');
    expect(delta.monthsSooner).toBe(2);
    expect(delta.interestSaved).toBe(0);
  });

  it('a sweep on an interest-bearing loan saves months and interest', () => {
    const loans: Loan[] = [
      { id: 'cc', name: 'Visa', balance: cents(500000), aprAnnual: 0.2299, minPayment: cents(15000) },
    ];
    const delta = sweepDebtFreeDelta(loans, cents(0), cents(100000), 'avalanche', START);
    expect(delta.monthsSooner).toBeGreaterThan(0);
    expect(delta.interestSaved).toBeGreaterThan(0);
  });

  it('a sweep covering every balance means debt-free today', () => {
    const loans: Loan[] = [
      { id: 'a', name: 'A', balance: cents(30000), aprAnnual: 0, minPayment: cents(10000) },
      { id: 'b', name: 'B', balance: cents(50000), aprAnnual: 0, minPayment: cents(10000) },
    ];
    const delta = sweepDebtFreeDelta(loans, cents(0), cents(80000), 'avalanche', START);
    expect(delta.sweptDebtFreeDate).toBe('2026-01-15');
    expect(delta.monthsSooner).toBeGreaterThan(0);
  });

  it('cascades an oversized lump across loans in strategy order', () => {
    // avalanche: 12% loan first. Sweep $400 clears A ($300) and takes B to $400.
    const loans: Loan[] = [
      { id: 'a', name: 'A', balance: cents(30000), aprAnnual: 0.12, minPayment: cents(10000) },
      { id: 'b', name: 'B', balance: cents(50000), aprAnnual: 0, minPayment: cents(10000) },
    ];
    const delta = sweepDebtFreeDelta(loans, cents(0), cents(40000), 'avalanche', START);
    // remaining: B $400 at $100/mo (its own min only) → 4 months → 2026-05-15
    expect(delta.sweptDebtFreeDate).toBe('2026-05-15');
  });
});

import { describe, expect, it } from 'vitest';
import { cents, computeHealthScore, type HealthInputs } from '../src/index.js';

const BASE: HealthInputs = {
  liquidCents: cents(1200000), // $12k
  monthlyExpensesCents: cents(400000), // $4k → 3 months banked
  monthlyIncomeCents: cents(600000), // $6k
  monthlySavingsCents: cents(90000), // 15%
  totalDebtCents: cents(1000000), // $10k
  weightedDebtRate: 0.24,
  netWorthTrendCents: cents(600000), // +1 month of income
};

describe('computeHealthScore', () => {
  it('hand-checked composite: 65', () => {
    // liquidity 3/6mo → 50; burden 2,400/72,000 = 3.33% → (1−0.1333)×100 = 86.67
    // savings 15/20 → 75; trend 1/3 → 33.33
    // 50×0.3 + 86.67×0.3 + 75×0.25 + 33.33×0.15 = 64.75 → 65
    const h = computeHealthScore(BASE);
    expect(h.subscores.liquidity).toBe(50);
    expect(h.subscores.debtBurden).toBe(87);
    expect(h.subscores.savingsRate).toBe(75);
    expect(h.subscores.netWorthTrajectory).toBe(33);
    expect(h.score).toBe(65);
  });

  it('band boundaries: liquidity 0 and 6+ months', () => {
    expect(computeHealthScore({ ...BASE, liquidCents: cents(0) }).subscores.liquidity).toBe(0);
    expect(computeHealthScore({ ...BASE, liquidCents: cents(2400000) }).subscores.liquidity).toBe(100);
    expect(computeHealthScore({ ...BASE, liquidCents: cents(9900000) }).subscores.liquidity).toBe(100);
  });

  it('band boundaries: debt burden 0% → 100 and ≥25% of income → 0', () => {
    expect(computeHealthScore({ ...BASE, totalDebtCents: cents(0) }).subscores.debtBurden).toBe(100);
    // 75,000 × 0.24 = 18,000 interest = 25% of 72,000 income → 0
    expect(
      computeHealthScore({ ...BASE, totalDebtCents: cents(7500000) }).subscores.debtBurden,
    ).toBe(0);
  });

  it('band boundaries: savings 20% → 100; zero → 0', () => {
    expect(computeHealthScore({ ...BASE, monthlySavingsCents: cents(120000) }).subscores.savingsRate).toBe(100);
    expect(computeHealthScore({ ...BASE, monthlySavingsCents: cents(0) }).subscores.savingsRate).toBe(0);
  });

  it('band boundaries: flat or falling net worth → 0; +3 months of income → 100', () => {
    expect(computeHealthScore({ ...BASE, netWorthTrendCents: cents(0) }).subscores.netWorthTrajectory).toBe(0);
    expect(computeHealthScore({ ...BASE, netWorthTrendCents: cents(-500000) }).subscores.netWorthTrajectory).toBe(0);
    expect(
      computeHealthScore({ ...BASE, netWorthTrendCents: cents(1800000) }).subscores.netWorthTrajectory,
    ).toBe(100);
  });

  it('zero income with debt outstanding scores 0 on debt burden', () => {
    const h = computeHealthScore({ ...BASE, monthlyIncomeCents: cents(0) });
    expect(h.subscores.debtBurden).toBe(0);
    expect(h.subscores.savingsRate).toBe(0);
  });

  it('exposes transparent drivers for Flint to narrate (never recompute)', () => {
    const h = computeHealthScore(BASE);
    expect(h.drivers.emergencyFundMonths).toBeCloseTo(3, 10);
    expect(h.drivers.annualInterestLoadCents).toBe(240000);
    expect(h.drivers.interestToIncomeRatio).toBeCloseTo(0.03333, 4);
  });
});

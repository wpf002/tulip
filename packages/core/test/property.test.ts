import { describe, expect, it } from 'vitest';
import {
  cents,
  analyzeDeal,
  propertyEquity,
  analyzeSellVsHold,
  simulatePurchaseImpact,
  type Goal,
} from '../src/index.js';

describe('analyzeDeal', () => {
  it('hand-checked: $200k purchase, $50k down, 6%/30y, $2,000 rent, $800 expenses', () => {
    const deal = analyzeDeal({
      purchasePrice: cents(20000000),
      downPayment: cents(5000000),
      aprAnnual: 0.06,
      termMonths: 360,
      monthlyRent: cents(200000),
      monthlyExpenses: cents(80000),
    });
    // loan $150,000 @ 6%/360 → payment ceil(899.3258) = $899.33
    expect(deal.loanAmount).toBe(15000000);
    expect(deal.monthlyDebtService).toBe(89933);
    // NOI $1,200/mo → cap rate 14,400 / 200,000 = 7.2%
    expect(deal.monthlyNOI).toBe(120000);
    expect(deal.capRate).toBeCloseTo(0.072, 10);
    // cashflow 2,000 − 800 − 899.33 = $300.67
    expect(deal.monthlyCashflow).toBe(30067);
    // cash-on-cash = 3,608.04 / 50,000 = 7.216%
    expect(deal.cashOnCash).toBeCloseTo(0.0721608, 6);
    // DSCR = 1,200 / 899.33
    expect(deal.dscr).toBeCloseTo(1.33432, 4);
  });

  it('all-cash deal: no debt service, DSCR infinite', () => {
    const deal = analyzeDeal({
      purchasePrice: cents(10000000),
      downPayment: cents(10000000),
      aprAnnual: 0.06,
      termMonths: 360,
      monthlyRent: cents(100000),
      monthlyExpenses: cents(40000),
    });
    expect(deal.monthlyDebtService).toBe(0);
    expect(deal.monthlyCashflow).toBe(60000);
    expect(deal.dscr).toBe(Infinity);
  });

  it('rejects a down payment above the purchase price', () => {
    expect(() =>
      analyzeDeal({
        purchasePrice: cents(100),
        downPayment: cents(200),
        aprAnnual: 0.06,
        termMonths: 360,
        monthlyRent: cents(0),
        monthlyExpenses: cents(0),
      }),
    ).toThrow();
  });
});

describe('propertyEquity', () => {
  it('value minus mortgage', () => {
    expect(propertyEquity({ estimatedValue: cents(30000000), mortgageBalance: cents(20000000) })).toBe(10000000);
  });
});

describe('analyzeSellVsHold', () => {
  it('hand-checked degenerate rates: paid-off rental favors holding', () => {
    const r = analyzeSellVsHold({
      property: {
        estimatedValue: cents(30000000),
        mortgageBalance: cents(0),
        aprAnnual: 0,
        remainingTermMonths: 1,
        monthlyRent: cents(100000),
        monthlyExpenses: cents(40000),
      },
      horizonMonths: 12,
      sellingCostRate: 0.06,
      appreciationRate: 0,
      marketReturn: 0,
    });
    // sell: 300,000 × 0.94 = $282,000, flat at 0% market
    expect(r.sell.netProceeds).toBe(28200000);
    expect(r.sell.projectedValue).toBe(28200000);
    // hold: $300,000 equity + 12 × $600 cashflow = $307,200
    expect(r.hold.cumulativeCashflow).toBe(720000);
    expect(r.hold.projectedValue).toBe(30720000);
    expect(r.bestOption).toBe('hold');
  });

  it('cash-out refi: hand-checked cash out at 75% LTV', () => {
    const r = analyzeSellVsHold({
      property: {
        estimatedValue: cents(30000000),
        mortgageBalance: cents(10000000),
        aprAnnual: 0.06,
        remainingTermMonths: 360,
        monthlyRent: cents(200000),
        monthlyExpenses: cents(60000),
      },
      horizonMonths: 60,
      sellingCostRate: 0.06,
      appreciationRate: 0.03,
      marketReturn: 0.07,
      cashOutRefi: { ltv: 0.75, newAprAnnual: 0.055, newTermMonths: 360, closingCosts: cents(500000) },
    });
    // cash out = 225,000 − 100,000 − 5,000 = $120,000
    expect(r.refi?.cashOut).toBe(12000000);
    expect(r.refi!.newPayment).toBeGreaterThan(0);
    expect(['sell', 'hold', 'refi']).toContain(r.bestOption);
  });
});

describe('simulatePurchaseImpact', () => {
  const START = new Date(2026, 0, 15);
  const GOALS: Goal[] = [
    { id: 'a', name: 'Rental fund', target: cents(1200000), saved: cents(0), targetDate: '2029-06-01', priority: 1 },
    { id: 'b', name: 'Loan payoff', target: cents(600000), saved: cents(0), targetDate: '2029-06-01', priority: 1 },
  ];
  const DEAL = {
    purchasePrice: cents(20000000),
    downPayment: cents(5000000),
    closingCosts: cents(500000),
    aprAnnual: 0.06,
    termMonths: 360,
    monthlyRent: cents(200000),
    monthlyExpenses: cents(80000),
  };

  it('hand-checked: cashflow-positive deal pulls both goal dates in', () => {
    const r = simulatePurchaseImpact({
      deal: DEAL,
      liquidCash: cents(6000000), // $60k
      goals: GOALS,
      monthlySurplus: cents(100000), // $1,000/mo split evenly
      startDate: START,
    });
    // cash: $50k down + $5k closing = $55k required, $5k left
    expect(r.cashRequired).toBe(5500000);
    expect(r.cashAfter).toBe(500000);
    expect(r.affordable).toBe(true);
    // equity gained (=down payment) minus cash spent = −closing costs
    expect(r.netWorthDelta).toBe(-500000);
    // deal cashflow $300.67/mo lifts the surplus to $1,300.67
    expect(r.monthlyCashflow).toBe(30067);
    expect(r.surplusAfter).toBe(130067);
    // before: $500/goal → A 24mo (2028-01-15), B 12mo (2027-01-15)
    // after: [65034, 65033] → A ceil(1.2M/65034)=19mo (2027-08-15),
    //        B ceil(600k/65033)=10mo (2026-11-15)
    const [a, b] = r.goalShifts;
    expect(a).toMatchObject({ dateBefore: '2028-01-15', dateAfter: '2027-08-15', monthsDelta: -5 });
    expect(b).toMatchObject({ dateBefore: '2027-01-15', dateAfter: '2026-11-15', monthsDelta: -2 });
  });

  it('flags an unaffordable deal', () => {
    const r = simulatePurchaseImpact({
      deal: DEAL,
      liquidCash: cents(4000000), // $40k < $55k required
      goals: GOALS,
      monthlySurplus: cents(100000),
      startDate: START,
    });
    expect(r.affordable).toBe(false);
    expect(r.cashAfter).toBe(-1500000);
  });

  it('a cashflow-negative deal that eats the whole surplus stalls every goal', () => {
    // vacant property: no rent, $800 expenses, $899.33 debt service → −$1,699.33/mo
    const r = simulatePurchaseImpact({
      deal: { ...DEAL, monthlyRent: cents(0) },
      liquidCash: cents(10000000),
      goals: GOALS,
      monthlySurplus: cents(100000), // $1,000 < $1,699.33 drain
      startDate: START,
    });
    expect(r.surplusAfter).toBeLessThan(0);
    for (const shift of r.goalShifts) {
      expect(shift.dateAfter).toBeNull();
      expect(shift.monthsDelta).toBeNull();
    }
  });
});

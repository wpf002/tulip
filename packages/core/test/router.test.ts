import { describe, expect, it } from 'vitest';
import { cents, routeNextDollar, buildOpportunities, type RouterProfile } from '../src/index.js';

const BASE: RouterProfile = {
  marginalTaxRate: 0.24,
  expectedMarketReturn: 0.07,
  debts: [],
};

describe('routeNextDollar', () => {
  it('401k match is always #1 while capacity remains — then high-interest debt', () => {
    const routed = routeNextDollar(cents(50000), {
      ...BASE,
      employerMatch: { matchRate: 0.5, remainingMatchableContribution: cents(25000) },
      debts: [{ id: 'cc', name: 'Visa', aprAnnual: 0.24, balance: cents(1000000) }],
    });
    expect(routed).toHaveLength(2);
    expect(routed[0]!.opportunity.kind).toBe('EMPLOYER_401K_MATCH');
    expect(routed[0]!.amount).toBe(25000);
    // 50% match + 7% market = 57% effective; 25000 × 0.57 = $142.50
    expect(routed[0]!.projectedAnnualValue).toBe(14250);
    expect(routed[1]!.opportunity.kind).toBe('HIGH_INTEREST_DEBT');
    expect(routed[1]!.amount).toBe(25000);
    expect(routed[1]!.projectedAnnualValue).toBe(6000); // 25000 × 0.24
  });

  it('high-interest debt beats the market', () => {
    const routed = routeNextDollar(cents(30000), {
      ...BASE,
      debts: [{ id: 'cc', name: 'Visa', aprAnnual: 0.2299, balance: cents(500000) }],
      taxableInvesting: true,
    });
    expect(routed[0]!.opportunity.kind).toBe('HIGH_INTEREST_DEBT');
    expect(routed[0]!.amount).toBe(30000); // debt has capacity for all of it
  });

  it('fills each capacity exactly and never loses a cent', () => {
    const routed = routeNextDollar(cents(20000), {
      ...BASE,
      employerMatch: { matchRate: 1, remainingMatchableContribution: cents(10000) },
      emergencyFund: { current: cents(0), floor: cents(5000), savingsApr: 0.04 },
      debts: [{ id: 'cc', name: 'Visa', aprAnnual: 0.24, balance: cents(3000) }],
      taxableInvesting: true,
    });
    expect(routed.map((r) => r.amount)).toEqual([10000, 5000, 3000, 2000]);
    expect(routed.reduce((s, r) => s + r.amount, 0)).toBe(20000);
    expect(routed[3]!.opportunity.kind).toBe('TAXABLE_INVESTMENT');
  });

  it('honors the liquidity floor before investing, despite a lower return', () => {
    const routed = routeNextDollar(cents(8000), {
      ...BASE,
      emergencyFund: { current: cents(0), floor: cents(10000), savingsApr: 0.04 },
      taxableInvesting: true,
    });
    expect(routed).toHaveLength(1);
    expect(routed[0]!.opportunity.kind).toBe('EMERGENCY_FUND');
    expect(routed[0]!.amount).toBe(8000);
  });

  it('deductible mortgage interest lowers its effective return below the market', () => {
    // 6% × (1 − 0.24) = 4.56% < 7% market → invest first; non-deductible 8% > 7% → prepay first
    const deductible = routeNextDollar(cents(10000), {
      ...BASE,
      debts: [{ id: 'm', name: 'Mortgage', aprAnnual: 0.06, balance: cents(1000000), isMortgage: true, interestDeductible: true }],
      taxableInvesting: true,
    });
    expect(deductible[0]!.opportunity.kind).toBe('TAXABLE_INVESTMENT');

    const nonDeductible = routeNextDollar(cents(10000), {
      ...BASE,
      debts: [{ id: 'm', name: 'Mortgage', aprAnnual: 0.08, balance: cents(1000000), isMortgage: true }],
      taxableInvesting: true,
    });
    expect(nonDeductible[0]!.opportunity.kind).toBe('MORTGAGE_PREPAY');
  });

  it('traditional retirement gets the year-one deduction boost; Roth does not', () => {
    const debts = [{ id: 'p', name: 'Personal loan', aprAnnual: 0.1, balance: cents(1000000) }];
    const traditional = routeNextDollar(cents(10000), {
      ...BASE,
      debts,
      retirement: { kind: 'TRADITIONAL', label: 'Traditional 401(k)', remainingCapacity: cents(500000) },
    });
    // 7% + 24% deduction = 31% > 10% loan
    expect(traditional[0]!.opportunity.kind).toBe('RETIREMENT');

    const roth = routeNextDollar(cents(10000), {
      ...BASE,
      debts,
      retirement: { kind: 'ROTH', label: 'Roth IRA', remainingCapacity: cents(500000) },
    });
    // 7% < 10% loan
    expect(roth[0]!.opportunity.kind).toBe('HIGH_INTEREST_DEBT');
  });

  it('builds no emergency-fund opportunity once the floor is met', () => {
    const opps = buildOpportunities({
      ...BASE,
      emergencyFund: { current: cents(10000), floor: cents(10000), savingsApr: 0.04 },
    });
    expect(opps.find((o) => o.kind === 'EMERGENCY_FUND')).toBeUndefined();
  });
});

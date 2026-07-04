import { describe, expect, it } from 'vitest';
import { cents, resolveGoalConflict, allocateCustom, type Goal } from '../src/index.js';

const START = new Date(2026, 0, 15);

const A: Goal = { id: 'a', name: 'Rental down payment', target: cents(1200000), saved: cents(0), targetDate: '2029-06-01', priority: 1 };
const B: Goal = { id: 'b', name: 'Loan payoff', target: cents(600000), saved: cents(0), targetDate: '2029-06-01', priority: 1 };

describe('resolveGoalConflict', () => {
  it('hand-checked frontier for two goals sharing $1,000/mo', () => {
    const scenarios = resolveGoalConflict([A, B], cents(100000), START);
    expect(scenarios.map((s) => s.label)).toEqual([
      'Accelerate Rental down payment',
      'Accelerate Loan payoff',
      'Balanced',
    ]);

    const [accelA, accelB, balanced] = scenarios;
    // Accelerate A (3:1): A $750 → ceil(12000/750)=16mo → 2027-05-15; B $250 → 24mo → 2028-01-15
    expect(accelA!.perGoalMonthly).toEqual({ a: 75000, b: 25000 });
    expect(accelA!.projectedDates).toEqual({ a: '2027-05-15', b: '2028-01-15' });
    // Accelerate B (1:3): A $250 → 48mo → 2030-01-15; B $750 → 8mo → 2026-09-15
    expect(accelB!.perGoalMonthly).toEqual({ a: 25000, b: 75000 });
    expect(accelB!.projectedDates).toEqual({ a: '2030-01-15', b: '2026-09-15' });
    // Balanced: A $500 → 24mo → 2028-01-15; B $500 → 12mo → 2027-01-15
    expect(balanced!.perGoalMonthly).toEqual({ a: 50000, b: 50000 });
    expect(balanced!.projectedDates).toEqual({ a: '2028-01-15', b: '2027-01-15' });
  });

  it('splits an odd surplus penny-exactly', () => {
    const scenarios = resolveGoalConflict([A, B], cents(100001), START);
    for (const s of scenarios) {
      const total = Object.values(s.perGoalMonthly).reduce((sum, c) => sum + c, 0);
      expect(total).toBe(100001);
    }
  });

  it('excludes completed goals and handles a single open goal', () => {
    const done: Goal = { ...B, id: 'done', saved: cents(600000) };
    const scenarios = resolveGoalConflict([A, done], cents(100000), START);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]!.label).toBe('All in on Rental down payment');
    expect(scenarios[0]!.perGoalMonthly).toEqual({ a: 100000 });
    expect(scenarios[0]!.projectedDates['a']).toBe('2027-01-15'); // ceil(12000/1000)=12mo
  });

  it('returns no scenarios without surplus or open goals', () => {
    expect(resolveGoalConflict([A, B], cents(0), START)).toEqual([]);
    expect(resolveGoalConflict([], cents(100000), START)).toEqual([]);
  });

  it('marks goals unreachable at $0/mo allocation as never (null)', () => {
    const scenarios = allocateCustom([A, B], cents(100000), [1, 0], START);
    expect(scenarios.projectedDates['b']).toBeNull();
    expect(scenarios.monthsToComplete['b']).toBeNull();
  });
});

describe('allocateCustom', () => {
  it('hand-checked 70/30 slider split', () => {
    const s = allocateCustom([A, B], cents(100000), [7, 3], START);
    expect(s.perGoalMonthly).toEqual({ a: 70000, b: 30000 });
    // A: ceil(12000/700)=18mo → 2027-07-15; B: ceil(6000/300)=20mo → 2027-09-15
    expect(s.projectedDates).toEqual({ a: '2027-07-15', b: '2027-09-15' });
  });

  it('rejects mismatched weights', () => {
    expect(() => allocateCustom([A, B], cents(100000), [1], START)).toThrow();
  });
});

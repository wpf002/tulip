import { describe, it, expect } from 'vitest';
import { fromDollars, toDollars, add, sub, allocate, cents } from '../src/money/index.js';

describe('money primitives', () => {
  it('parses dollars to integer cents (half-up)', () => {
    expect(fromDollars('1234.56')).toBe(123456);
    expect(fromDollars(0.1 + 0.2)).toBe(30); // float-safe at the boundary
  });
  it('rejects non-integer cents', () => {
    expect(() => cents(10.5)).toThrow();
  });
  it('adds and subtracts exactly', () => {
    expect(add(fromDollars('0.10'), fromDollars('0.20'))).toBe(30);
    expect(sub(fromDollars('1.00'), fromDollars('0.99'))).toBe(1);
  });
  it('allocate never loses a penny', () => {
    const parts = allocate(fromDollars('100.00'), [1, 1, 1]);
    expect(parts.reduce((s, p) => s + p, 0)).toBe(10000);
    expect(parts).toEqual([3334, 3333, 3333]);
  });
});

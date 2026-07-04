import { describe, expect, it } from 'vitest';
import { extractNumbers, verifyGrounded } from '../src/guardrail.js';

/**
 * ROADMAP guardrail tests: assert Flint responses never introduce numbers
 * absent from the engine output. verifyGrounded() is the runtime enforcement;
 * these tests pin its behavior without any network access.
 */

describe('extractNumbers', () => {
  it('normalizes currency, commas, and percentages', () => {
    expect(extractNumbers('You save $1,234.56 (7.80%) over 32 months')).toEqual([
      '1234.56',
      '7.8',
      '32',
    ]);
  });

  it('handles negatives and trailing zeros', () => {
    expect(extractNumbers('net worth -$7,600.00')).toEqual(['-7600']);
  });
});

describe('verifyGrounded', () => {
  const engineOutput = {
    debtFreeDate: '2032-03-03',
    monthsToDebtFree: 68,
    totalInterestCents: 605952,
    snowballCostsExtraInterestCents: 0,
    aprAnnual: 0.078,
  };

  it('passes when every number comes from the engine output', () => {
    const reply =
      'You will be debt-free in 68 months (March 2032), paying $6,059.52 of interest at 7.8% APR.';
    const result = verifyGrounded(reply, engineOutput);
    expect(result.grounded).toBe(true);
    expect(result.novelNumbers).toEqual([]);
  });

  it('rejects a response that invents a number', () => {
    const reply = 'You will save around $9,999 if you pay extra.';
    const result = verifyGrounded(reply, engineOutput);
    expect(result.grounded).toBe(false);
    expect(result.novelNumbers).toContain('9999');
  });

  it('rejects arithmetic the model did itself (halving a context number)', () => {
    // 605952 / 2 = 302976 — not in context, must be flagged
    const reply = 'Half of your interest is $3,029.76.';
    expect(verifyGrounded(reply, engineOutput).grounded).toBe(false);
  });

  it('accepts cents narrated as dollars and rounded dollars', () => {
    expect(verifyGrounded('Interest: $6,059.52.', engineOutput).grounded).toBe(true);
    expect(verifyGrounded('Roughly $6,060 in interest.', engineOutput).grounded).toBe(true);
  });

  it('accepts decimal rates narrated as percentages', () => {
    expect(verifyGrounded('Your APR is 7.8%.', engineOutput).grounded).toBe(true);
  });

  it('accepts date components and benign counting words', () => {
    const reply = 'By 2032-03-03 you clear both debts, one at a time (2 total).';
    expect(verifyGrounded(reply, engineOutput).grounded).toBe(true);
  });

  it('finds numbers nested anywhere in structured context', () => {
    const ctx = { routed: [{ amountCents: 25000, rationale: '57.0% effective return' }] };
    expect(verifyGrounded('Put $250 to work at 57% effective return.', ctx).grounded).toBe(true);
    expect(verifyGrounded('Put $999 to work.', ctx).grounded).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { toPlainProse } from '../src/prose.js';

describe('toPlainProse', () => {
  it('strips bold and heading markers', () => {
    expect(toPlainProse('## Why the Visa comes first\n\nIt is **pure math** at 22.99% APR.')).toBe(
      'Why the Visa comes first\n\nIt is pure math at 22.99% APR.',
    );
  });

  it('converts markdown list markers to bullets', () => {
    expect(toPlainProse('- **Visa:** 22.99% APR\n- **Sallie Mae:** 7.80% APR')).toBe(
      '• Visa: 22.99% APR\n• Sallie Mae: 7.80% APR',
    );
    expect(toPlainProse('1. First thing\n2. Second thing')).toBe('• First thing\n• Second thing');
  });

  it('strips italics and inline code without touching numbers or math symbols', () => {
    expect(toPlainProse('That is *nearly* `3x` more — 22.99% vs 7.8%, a 3× gap.')).toBe(
      'That is nearly 3x more — 22.99% vs 7.8%, a 3× gap.',
    );
  });

  it('leaves plain prose and dollar amounts untouched', () => {
    const plain = 'Your net worth is $42,400.00 — $365,400.00 in assets minus $323,000.00 owed.';
    expect(toPlainProse(plain)).toBe(plain);
  });

  it('collapses the blank-line rubble left by removed structure', () => {
    expect(toPlainProse('## Head\n\n\n\nBody text.')).toBe('Head\n\nBody text.');
  });
});

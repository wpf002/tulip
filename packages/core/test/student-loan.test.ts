import { describe, expect, it } from 'vitest';
import {
  cents,
  povertyGuideline,
  idrMonthlyPayment,
  standardTenYearPayment,
  projectPslf,
  projectForgivenessTaxBomb,
  analyzeStudentRefi,
  refiForfeitsFederalBenefits,
  type PovertyTable,
  type StudentLoan,
} from '../src/index.js';

const START = new Date(2026, 0, 15);

// 2024 contiguous-US table — injected, engines never hardcode a year.
const POVERTY_2024: PovertyTable = {
  baseAnnual: cents(1506000), // $15,060
  perAdditionalPersonAnnual: cents(538000), // $5,380
};

describe('povertyGuideline', () => {
  it('family of 3 = $15,060 + 2 × $5,380 = $25,820', () => {
    expect(povertyGuideline(POVERTY_2024, 3)).toBe(2582000);
  });

  it('rejects a non-positive family size', () => {
    expect(() => povertyGuideline(POVERTY_2024, 0)).toThrow();
  });
});

describe('idrMonthlyPayment', () => {
  const base = { agiAnnual: cents(6000000), familySize: 1, povertyTable: POVERTY_2024, balance: cents(3000000), aprAnnual: 0.068 };

  it('SAVE undergrad: AGI $60k, family 1 → $108.81', () => {
    // discretionary = 60,000 − 2.25 × 15,060 = $26,115; × 5% / 12 = 108.8125 → $108.81
    expect(idrMonthlyPayment({ ...base, plan: 'SAVE' })).toBe(10881);
  });

  it('SAVE all-grad: 10% rate → $217.63', () => {
    // 26,115 × 10% / 12 = 217.625 → half-up $217.63
    expect(idrMonthlyPayment({ ...base, plan: 'SAVE', gradShare: 1 })).toBe(21763);
  });

  it('PAYE: AGI $60k, family 1 → $311.75 (below the standard cap)', () => {
    // discretionary = 60,000 − 1.5 × 15,060 = $37,410; × 10% / 12 = $311.75
    expect(idrMonthlyPayment({ ...base, plan: 'PAYE' })).toBe(31175);
  });

  it('PAYE caps at the standard 10-year payment for high earners', () => {
    // $30k @ 6.8% / 120mo standard payment = $345.25 (ceil of 345.244)
    expect(standardTenYearPayment(cents(3000000), 0.068)).toBe(34525);
    expect(idrMonthlyPayment({ ...base, plan: 'PAYE', agiAnnual: cents(20000000) })).toBe(34525);
  });

  it('IBR classic 15% → $467.63; new borrower 10% → $311.75', () => {
    // 37,410 × 15% / 12 = 467.625 → half-up $467.63. Needs a $60k balance so the
    // standard-payment cap ($690.49) doesn't bind.
    const big = { ...base, balance: cents(6000000) };
    expect(idrMonthlyPayment({ ...big, plan: 'IBR' })).toBe(46763);
    expect(idrMonthlyPayment({ ...big, plan: 'IBR', newBorrower: true })).toBe(31175);
  });

  it('IBR 15% caps at the standard payment on a small balance', () => {
    // $467.63 uncapped > $345.25 standard cap on a $30k balance
    expect(idrMonthlyPayment({ ...base, plan: 'IBR' })).toBe(34525);
  });

  it('floors at $0 when AGI is below protected income', () => {
    // family 4 guideline = $31,200; PAYE protects 1.5× = $46,800 > $20,000 AGI
    expect(idrMonthlyPayment({ ...base, plan: 'PAYE', agiAnnual: cents(2000000), familySize: 4 })).toBe(0);
  });
});

describe('projectPslf', () => {
  it('hand-checked: $1,000 @ 12%, $300/mo, 117 made → $121.27 forgiven on 2026-04-15', () => {
    // m1: +$10.00 int, −$300 → $710.00
    // m2:  +$7.10 int, −$300 → $417.10
    // m3:  +$4.17 int, −$300 → $121.27
    const p = projectPslf({ balance: cents(100000), aprAnnual: 0.12 }, cents(30000), 117, START);
    expect(p.paymentsRemaining).toBe(3);
    expect(p.projectedForgiven).toBe(12127);
    expect(p.paidUntilForgiveness).toBe(90000);
    expect(p.forgivenessDate).toBe('2026-04-15');
  });

  it('lets the balance grow when the IDR payment is below interest', () => {
    // $1,000 @ 12%, $5/mo, 2 remaining: m1 → $1,005.00; m2 → $1,010.05
    const p = projectPslf({ balance: cents(100000), aprAnnual: 0.12 }, cents(500), 118, START);
    expect(p.projectedForgiven).toBe(101005);
  });

  it('already eligible at 120 payments: forgives the current balance now', () => {
    const p = projectPslf({ balance: cents(100000), aprAnnual: 0.12 }, cents(500), 120, START);
    expect(p.alreadyEligible).toBe(true);
    expect(p.projectedForgiven).toBe(100000);
    expect(p.paidUntilForgiveness).toBe(0);
  });

  it('forgives nothing when the loan pays off before the 120th payment', () => {
    const p = projectPslf({ balance: cents(50000), aprAnnual: 0 }, cents(30000), 100, START);
    expect(p.projectedForgiven).toBe(0);
    expect(p.paidUntilForgiveness).toBe(50000);
  });
});

describe('projectForgivenessTaxBomb', () => {
  it('hand-checked: $1,010.05 forgiven at 24% marginal → $242.41 tax bomb', () => {
    const t = projectForgivenessTaxBomb({ balance: cents(100000), aprAnnual: 0.12 }, cents(500), 2, 0.24, START);
    expect(t.projectedForgiven).toBe(101005);
    expect(t.taxBomb).toBe(24241);
    expect(t.forgivenessDate).toBe('2026-03-15');
  });

  it('rejects a marginal rate outside [0, 1]', () => {
    expect(() =>
      projectForgivenessTaxBomb({ balance: cents(100000), aprAnnual: 0.12 }, cents(500), 2, 1.5, START),
    ).toThrow();
  });
});

describe('analyzeStudentRefi', () => {
  const federal: StudentLoan = {
    id: 'sl1',
    name: 'Federal direct',
    balance: cents(3000000),
    aprAnnual: 0.078,
    minPayment: cents(36100),
    loanType: 'FEDERAL',
  };

  it('hand-checked: $30k @ 7.8% → 5%/120mo, $500 fees: new payment $318.20, break-even 12mo', () => {
    // annuity: 30,000 × (0.05/12) / (1 − (1+0.05/12)^−120) = 318.197 → ceil $318.20
    // (standard 10y/5% tables quote $318.20). savings $42.80/mo; 500/42.80 = 11.7 → 12
    const a = analyzeStudentRefi(federal, cents(36100), {
      newAprAnnual: 0.05,
      newTermMonths: 120,
      fees: cents(50000),
    });
    expect(a.newPayment).toBe(31820);
    expect(a.monthlySavings).toBe(4280);
    expect(a.breakEvenMonths).toBe(12);
    expect(a.netSavings).toBeGreaterThan(0);
  });

  it('ALWAYS flags forfeited federal benefits on a federal loan', () => {
    const a = analyzeStudentRefi(federal, cents(36100), { newAprAnnual: 0.05, newTermMonths: 120, fees: cents(0) });
    expect(a.refiForfeitsFederalBenefits).toBe(true);
    expect(a.lostBenefits.length).toBeGreaterThan(0);
    expect(refiForfeitsFederalBenefits(federal)).toBe(true);
  });

  it('does not flag private loans', () => {
    const priv: StudentLoan = { ...federal, loanType: 'PRIVATE' };
    const a = analyzeStudentRefi(priv, cents(36100), { newAprAnnual: 0.05, newTermMonths: 120, fees: cents(0) });
    expect(a.refiForfeitsFederalBenefits).toBe(false);
    expect(a.lostBenefits).toHaveLength(0);
  });
});

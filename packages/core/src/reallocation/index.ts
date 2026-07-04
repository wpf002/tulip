import { type Cents, cents, add, sub, min, ZERO, isPositive } from '../money/index.js';
import { type Loan } from './../debt/amortization.js';
import { planPayoff, type Strategy } from '../debt/payoff.js';

export interface CategoryBudget {
  category: string;
  monthlyLimit: Cents;
  spentSoFar: Cents;
}

export interface CategorySurplus {
  category: string;
  surplus: Cents;
}

/** Under-budget categories and the total sweepable surplus. Over-budget counts as zero. */
export function detectSurplus(budgets: CategoryBudget[]): { total: Cents; perCategory: CategorySurplus[] } {
  const perCategory: CategorySurplus[] = [];
  let total = ZERO;
  for (const b of budgets) {
    const gap = sub(b.monthlyLimit, min(b.spentSoFar, b.monthlyLimit));
    if (isPositive(gap)) {
      perCategory.push({ category: b.category, surplus: gap });
      total = add(total, gap);
    }
  }
  return { total, perCategory };
}

export interface SweepDelta {
  baselineDebtFreeDate: string;
  sweptDebtFreeDate: string;
  monthsSooner: number;
  interestSaved: Cents;
}

/**
 * What happens to the debt-free date if `sweep` lands on the focus loan today?
 * The lump is applied to the strategy's focus loan (cascading to the next when
 * it overflows), then both plans are recomputed. Pure — dates injected.
 */
export function sweepDebtFreeDelta(
  loans: Loan[],
  monthlyExtra: Cents,
  sweep: Cents,
  strategy: Strategy,
  startDate: Date,
): SweepDelta {
  const baseline = planPayoff(loans, monthlyExtra, strategy, startDate);

  // Apply the lump in the strategy's payoff order (focus first).
  const order =
    strategy === 'avalanche'
      ? [...loans].sort((a, b) => b.aprAnnual - a.aprAnnual || a.balance - b.balance)
      : [...loans].sort((a, b) => a.balance - b.balance || b.aprAnnual - a.aprAnnual);
  let remainingSweep = sweep;
  const sweptBalances = new Map<string, Cents>(loans.map((l) => [l.id, l.balance]));
  for (const l of order) {
    if (!isPositive(remainingSweep)) break;
    const bal = sweptBalances.get(l.id)!;
    const applied = min(bal, remainingSweep);
    sweptBalances.set(l.id, sub(bal, applied));
    remainingSweep = sub(remainingSweep, applied);
  }

  const sweptLoans = loans
    .map((l) => ({ ...l, balance: sweptBalances.get(l.id)! }))
    .filter((l) => isPositive(l.balance));
  const swept =
    sweptLoans.length > 0
      ? planPayoff(sweptLoans, monthlyExtra, strategy, startDate)
      : { debtFreeDate: baseline.debtFreeDate, monthsToDebtFree: 0, totalInterest: ZERO };

  const sweptDate =
    sweptLoans.length > 0 ? swept.debtFreeDate : startDate.toISOString().slice(0, 10);

  return {
    baselineDebtFreeDate: baseline.debtFreeDate,
    sweptDebtFreeDate: sweptDate,
    monthsSooner: baseline.monthsToDebtFree - (sweptLoans.length > 0 ? swept.monthsToDebtFree : 0),
    interestSaved: sub(baseline.totalInterest, cents(Number(swept.totalInterest))),
  };
}

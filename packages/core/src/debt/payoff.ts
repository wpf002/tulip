import { type Cents, add, sub, min, ZERO, isPositive } from '../money/index.js';
import { type Loan, monthlyInterest } from './amortization.js';

export type Strategy = 'avalanche' | 'snowball';

export interface PayoffPlanResult {
  strategy: Strategy;
  monthsToDebtFree: number;
  debtFreeDate: string; // ISO yyyy-mm-dd, computed from `startDate`
  totalInterest: Cents;
  totalPaid: Cents;
  /** Per-loan payoff month, in the order each debt is cleared. */
  payoffOrder: Array<{ loanId: string; name: string; payoffMonth: number; interestPaid: Cents }>;
  /** Total remaining balance after each month — powers the payoff chart. */
  monthlySchedule: Array<{ month: number; remainingBalance: Cents; interestAccrued: Cents }>;
}

function orderLoans(loans: Loan[], strategy: Strategy): Loan[] {
  const copy = [...loans];
  if (strategy === 'avalanche') {
    // highest APR first — mathematically optimal
    copy.sort((a, b) => b.aprAnnual - a.aprAnnual || a.balance - b.balance);
  } else {
    // smallest balance first — psychological wins
    copy.sort((a, b) => a.balance - b.balance || b.aprAnnual - a.aprAnnual);
  }
  return copy;
}

function addMonths(startDate: Date, months: number): string {
  const d = new Date(startDate.getFullYear(), startDate.getMonth() + months, startDate.getDate());
  return d.toISOString().slice(0, 10);
}

const MAX_MONTHS = 1200;

/**
 * Simulate the debt-snowball/avalanche with a fixed total monthly budget.
 * `extraBudget` is applied on top of every loan's minimum, rolled to the
 * focus loan; freed minimums cascade as loans are cleared. Pure + deterministic.
 */
export function planPayoff(
  loans: Loan[],
  extraBudget: Cents,
  strategy: Strategy,
  startDate: Date = new Date(),
): PayoffPlanResult {
  const ordered = orderLoans(loans, strategy);
  const balances = new Map<string, Cents>(ordered.map((l) => [l.id, l.balance]));
  const interestPaid = new Map<string, Cents>(ordered.map((l) => [l.id, ZERO]));
  const payoffOrder: PayoffPlanResult['payoffOrder'] = [];
  const monthlySchedule: PayoffPlanResult['monthlySchedule'] = [];

  let totalInterest = ZERO;
  let totalPaid = ZERO;
  let month = 0;

  const remaining = () => ordered.filter((l) => isPositive(balances.get(l.id)!));

  while (remaining().length > 0 && month < MAX_MONTHS) {
    month += 1;
    let monthInterest = ZERO;

    // 1) accrue interest on every open loan
    for (const l of remaining()) {
      const bal = balances.get(l.id)!;
      const interest = monthlyInterest(bal, l.aprAnnual);
      balances.set(l.id, add(bal, interest));
      interestPaid.set(l.id, add(interestPaid.get(l.id)!, interest));
      totalInterest = add(totalInterest, interest);
      monthInterest = add(monthInterest, interest);
    }

    // 2) budget = sum of minimums (open loans) + extra, all rolled to focus loan
    let budget = extraBudget;
    for (const l of remaining()) budget = add(budget, l.minPayment);

    // 3) pay minimums first (except focus), then dump remainder on focus loan
    const open = remaining();
    const focus = open[0]!;
    for (let i = open.length - 1; i >= 0; i--) {
      const l = open[i]!;
      const bal = balances.get(l.id)!;
      const pay = l.id === focus.id ? min(budget, bal) : min(l.minPayment, bal, budget);
      const applied = min(pay, budget);
      balances.set(l.id, sub(bal, applied));
      budget = sub(budget, applied);
      totalPaid = add(totalPaid, applied);
      if (!isPositive(balances.get(l.id)!) && !payoffOrder.find((p) => p.loanId === l.id)) {
        payoffOrder.push({
          loanId: l.id,
          name: l.name,
          payoffMonth: month,
          interestPaid: interestPaid.get(l.id)!,
        });
      }
    }

    let remainingBalance = ZERO;
    for (const bal of balances.values()) remainingBalance = add(remainingBalance, bal);
    const previous = monthlySchedule[monthlySchedule.length - 1];
    if (previous && remainingBalance >= previous.remainingBalance) {
      throw new Error(
        'Payments do not cover monthly interest — this plan never reaches debt-free. Increase the minimums or extra budget.',
      );
    }
    monthlySchedule.push({ month, remainingBalance, interestAccrued: monthInterest });
  }

  return {
    strategy,
    monthsToDebtFree: month,
    debtFreeDate: addMonths(startDate, month),
    totalInterest,
    totalPaid,
    payoffOrder,
    monthlySchedule,
  };
}

/** Side-by-side comparison so the UI can show the true cost of choosing snowball. */
export function compareStrategies(loans: Loan[], extraBudget: Cents, startDate?: Date) {
  const avalanche = planPayoff(loans, extraBudget, 'avalanche', startDate);
  const snowball = planPayoff(loans, extraBudget, 'snowball', startDate);
  return {
    avalanche,
    snowball,
    interestDelta: sub(snowball.totalInterest, avalanche.totalInterest),
    monthsDelta: snowball.monthsToDebtFree - avalanche.monthsToDebtFree,
  };
}

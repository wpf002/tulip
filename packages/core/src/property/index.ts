import { type Cents, cents, sub, add } from '../money/index.js';
import { mortgagePayment, scheduledPayment, type Mortgage } from '../debt/mortgage.js';
import { amortize } from '../debt/amortization.js';

export interface DealInputs {
  purchasePrice: Cents;
  downPayment: Cents;
  aprAnnual: number;
  termMonths: number;
  monthlyRent: Cents;
  monthlyExpenses: Cents; // taxes, insurance, mgmt, maintenance reserve
  /** One-time closing costs; included in cash-on-cash denominator. */
  closingCosts?: Cents;
}

export interface DealMetrics {
  loanAmount: Cents;
  monthlyDebtService: Cents;
  monthlyNOI: Cents;
  /** annual NOI / purchase price */
  capRate: number;
  /** annual cashflow / cash invested (down payment + closing costs) */
  cashOnCash: number;
  /** monthly NOI / monthly debt service; lenders want ≥ 1.2 */
  dscr: number;
  monthlyCashflow: Cents;
}

/** Rental deal analyzer — the mortgage leg runs through the amortization engine. */
export function analyzeDeal(inputs: DealInputs): DealMetrics {
  if (inputs.downPayment > inputs.purchasePrice) throw new Error('Down payment exceeds purchase price');
  const loanAmount = sub(inputs.purchasePrice, inputs.downPayment);
  const monthlyDebtService =
    loanAmount > 0 ? mortgagePayment(loanAmount, inputs.aprAnnual, inputs.termMonths) : cents(0);
  const monthlyNOI = sub(inputs.monthlyRent, inputs.monthlyExpenses);
  const monthlyCashflow = sub(monthlyNOI, monthlyDebtService);
  const cashInvested = add(inputs.downPayment, inputs.closingCosts ?? cents(0));

  return {
    loanAmount,
    monthlyDebtService,
    monthlyNOI,
    capRate: inputs.purchasePrice > 0 ? (monthlyNOI * 12) / inputs.purchasePrice : 0,
    cashOnCash: cashInvested > 0 ? (monthlyCashflow * 12) / cashInvested : 0,
    dscr: monthlyDebtService > 0 ? monthlyNOI / monthlyDebtService : Infinity,
    monthlyCashflow,
  };
}

export interface OwnedProperty {
  estimatedValue: Cents;
  mortgageBalance: Cents;
  aprAnnual: number;
  remainingTermMonths: number;
  monthlyPayment?: Cents;
  monthlyRent: Cents;
  monthlyExpenses: Cents;
}

export function propertyEquity(p: Pick<OwnedProperty, 'estimatedValue' | 'mortgageBalance'>): Cents {
  return sub(p.estimatedValue, p.mortgageBalance);
}

export interface SellVsHoldInputs {
  property: OwnedProperty;
  horizonMonths: number;
  /** Selling costs as a fraction of value (agent fees, transfer tax…). */
  sellingCostRate: number;
  /** Injected annual appreciation assumption. */
  appreciationRate: number;
  /** Injected expected market return for reinvested sale proceeds. */
  marketReturn: number;
  cashOutRefi?: {
    /** New loan = LTV × current value. */
    ltv: number;
    newAprAnnual: number;
    newTermMonths: number;
    closingCosts: Cents;
  };
}

export interface SellVsHoldResult {
  /** Sell now, reinvest net proceeds at the market return for the horizon. */
  sell: { netProceeds: Cents; projectedValue: Cents };
  /** Keep: appreciated equity + cumulative rental cashflow over the horizon. */
  hold: { projectedEquity: Cents; cumulativeCashflow: Cents; projectedValue: Cents };
  /** Optional cash-out refi: cash pocketed + hold economics at the new payment. */
  refi: {
    cashOut: Cents;
    newPayment: Cents;
    monthlyCashflowAfter: Cents;
    projectedValue: Cents;
  } | null;
  bestOption: 'sell' | 'hold' | 'refi';
}

function balanceAfter(m: Mortgage, months: number): Cents {
  const result = amortize(
    { id: 'p', name: 'p', balance: m.balance, aprAnnual: m.aprAnnual, minPayment: scheduledPayment(m) },
    scheduledPayment(m),
  );
  if (months >= result.months) return cents(0);
  return result.schedule[months - 1]?.endingBalance ?? m.balance;
}

function compoundMonthly(amount: Cents, annualRate: number, months: number): Cents {
  return cents(Math.round(amount * Math.pow(1 + annualRate / 12, months)));
}

/**
 * Sell vs hold vs cash-out-refi over an injected horizon. Cashflows are summed
 * (not compounded) — a deliberate, documented simplification for the POC.
 */
export function analyzeSellVsHold(inputs: SellVsHoldInputs): SellVsHoldResult {
  const p = inputs.property;
  const H = inputs.horizonMonths;

  const netProceeds = cents(
    Math.round(p.estimatedValue * (1 - inputs.sellingCostRate)) - p.mortgageBalance,
  );
  const sellProjected = compoundMonthly(netProceeds, inputs.marketReturn, H);

  const mortgage: Mortgage = {
    balance: p.mortgageBalance,
    aprAnnual: p.aprAnnual,
    remainingTermMonths: p.remainingTermMonths,
    ...(p.monthlyPayment !== undefined ? { monthlyPayment: p.monthlyPayment } : {}),
  };
  const futureValue = cents(Math.round(p.estimatedValue * Math.pow(1 + inputs.appreciationRate / 12, H)));
  const payment = p.mortgageBalance > 0 ? scheduledPayment(mortgage) : cents(0);
  const futureBalance = p.mortgageBalance > 0 ? balanceAfter(mortgage, H) : cents(0);
  const monthlyCashflow = sub(sub(p.monthlyRent, p.monthlyExpenses), payment);
  const cumulativeCashflow = cents(monthlyCashflow * H);
  const holdEquity = sub(futureValue, futureBalance);
  const holdProjected = add(holdEquity, cumulativeCashflow);

  let refi: SellVsHoldResult['refi'] = null;
  if (inputs.cashOutRefi) {
    const r = inputs.cashOutRefi;
    const newLoan = cents(Math.round(p.estimatedValue * r.ltv));
    const cashOut = sub(sub(newLoan, p.mortgageBalance), r.closingCosts);
    const newPayment = mortgagePayment(newLoan, r.newAprAnnual, r.newTermMonths);
    const cashflowAfter = sub(sub(p.monthlyRent, p.monthlyExpenses), newPayment);
    const refiBalanceAfterH = balanceAfter(
      { balance: newLoan, aprAnnual: r.newAprAnnual, remainingTermMonths: r.newTermMonths },
      H,
    );
    const refiProjected = add(
      add(sub(futureValue, refiBalanceAfterH), cents(cashflowAfter * H)),
      compoundMonthly(cashOut, inputs.marketReturn, H),
    );
    refi = { cashOut, newPayment, monthlyCashflowAfter: cashflowAfter, projectedValue: refiProjected };
  }

  const options: Array<{ key: SellVsHoldResult['bestOption']; value: Cents }> = [
    { key: 'sell', value: sellProjected },
    { key: 'hold', value: holdProjected },
    ...(refi ? [{ key: 'refi' as const, value: refi.projectedValue }] : []),
  ];
  options.sort((a, b) => b.value - a.value);

  return {
    sell: { netProceeds, projectedValue: sellProjected },
    hold: { projectedEquity: holdEquity, cumulativeCashflow, projectedValue: holdProjected },
    refi,
    bestOption: options[0]!.key,
  };
}

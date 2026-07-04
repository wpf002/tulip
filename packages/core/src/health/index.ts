import { type Cents } from '../money/index.js';

export interface HealthInputs {
  liquidCents: Cents;
  monthlyExpensesCents: Cents;
  monthlyIncomeCents: Cents;
  monthlySavingsCents: Cents;
  totalDebtCents: Cents;
  /** rate-weighted so a $10k balance at 24% hurts more than $10k at 3%. */
  weightedDebtRate: number;
  netWorthTrendCents: Cents; // change over trailing window
}

export interface HealthScore {
  score: number; // 0..100, integer
  subscores: {
    liquidity: number;
    debtBurden: number;
    savingsRate: number;
    netWorthTrajectory: number;
  };
  drivers: {
    emergencyFundMonths: number;
    annualInterestLoadCents: Cents;
    interestToIncomeRatio: number;
    savingsRate: number;
    trendToMonthlyIncomeRatio: number;
  };
}

/** Weights sum to 1. Liquidity + debt dominate: they are what sink households. */
const WEIGHTS = { liquidity: 0.3, debtBurden: 0.3, savingsRate: 0.25, netWorthTrajectory: 0.15 };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * A single 0-100 wealth-health number with transparent drivers. Banding:
 * - liquidity: 0 → 0pts, 6+ months of expenses banked → 100, linear between
 * - debt burden: annual interest / annual income; 0 → 100, ≥ 25% → 0, linear
 * - savings rate: 0 → 0, ≥ 20% of income → 100, linear
 * - trajectory: trailing net-worth change vs monthly income; ≤ 0 → 0,
 *   ≥ 3 months of income → 100, linear
 */
export function computeHealthScore(inputs: HealthInputs): HealthScore {
  const emergencyFundMonths =
    inputs.monthlyExpensesCents > 0 ? inputs.liquidCents / inputs.monthlyExpensesCents : Infinity;
  const liquidity = clamp((emergencyFundMonths / 6) * 100, 0, 100);

  const annualInterestLoadCents = Math.round(inputs.totalDebtCents * inputs.weightedDebtRate) as Cents;
  const annualIncome = inputs.monthlyIncomeCents * 12;
  const interestToIncomeRatio =
    annualIncome > 0 ? annualInterestLoadCents / annualIncome : inputs.totalDebtCents > 0 ? 1 : 0;
  const debtBurden = clamp((1 - interestToIncomeRatio / 0.25) * 100, 0, 100);

  const savingsRate =
    inputs.monthlyIncomeCents > 0 ? inputs.monthlySavingsCents / inputs.monthlyIncomeCents : 0;
  const savingsScore = clamp((savingsRate / 0.2) * 100, 0, 100);

  const trendToMonthlyIncomeRatio =
    inputs.monthlyIncomeCents > 0 ? inputs.netWorthTrendCents / inputs.monthlyIncomeCents : 0;
  const trajectory = clamp((trendToMonthlyIncomeRatio / 3) * 100, 0, 100);

  const score = Math.round(
    liquidity * WEIGHTS.liquidity +
      debtBurden * WEIGHTS.debtBurden +
      savingsScore * WEIGHTS.savingsRate +
      trajectory * WEIGHTS.netWorthTrajectory,
  );

  return {
    score,
    subscores: {
      liquidity: Math.round(liquidity),
      debtBurden: Math.round(debtBurden),
      savingsRate: Math.round(savingsScore),
      netWorthTrajectory: Math.round(trajectory),
    },
    drivers: {
      emergencyFundMonths: Number.isFinite(emergencyFundMonths) ? emergencyFundMonths : -1,
      annualInterestLoadCents,
      interestToIncomeRatio,
      savingsRate,
      trendToMonthlyIncomeRatio,
    },
  };
}

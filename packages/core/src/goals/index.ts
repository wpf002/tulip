import { type Cents, allocate, isPositive } from '../money/index.js';

export interface Goal {
  id: string;
  name: string;
  target: Cents;
  saved: Cents;
  /** ISO date the user wants this by. */
  targetDate: string;
  priority: number; // 1 = highest
}

export interface AllocationScenario {
  label: string;
  /** goalId -> monthly contribution in cents. Sums exactly to the surplus. */
  perGoalMonthly: Record<string, Cents>;
  /** goalId -> projected completion date (ISO), or null if never at this rate. */
  projectedDates: Record<string, string | null>;
  /** goalId -> months to completion, or null. */
  monthsToComplete: Record<string, number | null>;
}

function addMonths(startDate: Date, months: number): string {
  const d = new Date(startDate.getFullYear(), startDate.getMonth() + months, startDate.getDate());
  return d.toISOString().slice(0, 10);
}

function project(goal: Goal, monthly: Cents, startDate: Date): { date: string | null; months: number | null } {
  const remaining = goal.target - goal.saved;
  if (remaining <= 0) return { date: addMonths(startDate, 0), months: 0 };
  if (monthly <= 0) return { date: null, months: null };
  const months = Math.ceil(remaining / monthly);
  return { date: addMonths(startDate, months), months };
}

function scenario(goals: Goal[], surplus: Cents, weights: number[], label: string, startDate: Date): AllocationScenario {
  const split = allocate(surplus, weights); // penny-exact, sums to surplus
  const perGoalMonthly: Record<string, Cents> = {};
  const projectedDates: Record<string, string | null> = {};
  const monthsToComplete: Record<string, number | null> = {};
  goals.forEach((g, i) => {
    perGoalMonthly[g.id] = split[i]!;
    const p = project(g, split[i]!, startDate);
    projectedDates[g.id] = p.date;
    monthsToComplete[g.id] = p.months;
  });
  return { label, perGoalMonthly, projectedDates, monthsToComplete };
}

const ACCELERATE_WEIGHT = 3;

/**
 * Model competing goals sharing one monthly surplus and return the tradeoff
 * frontier: one "accelerate X" scenario per goal (X gets 3× weight) plus an
 * even "balanced" split. Every projected date is recomputed per allocation
 * with penny-exact splits via allocate(). Pure — the start date is injected.
 */
export function resolveGoalConflict(
  goals: Goal[],
  monthlySurplus: Cents,
  startDate: Date,
): AllocationScenario[] {
  const open = goals.filter((g) => isPositive((g.target - g.saved) as Cents));
  if (open.length === 0 || monthlySurplus <= 0) return [];
  if (open.length === 1) {
    return [scenario(open, monthlySurplus, [1], `All in on ${open[0]!.name}`, startDate)];
  }

  const scenarios: AllocationScenario[] = [];
  for (const focus of open) {
    scenarios.push(
      scenario(
        open,
        monthlySurplus,
        open.map((g) => (g.id === focus.id ? ACCELERATE_WEIGHT : 1)),
        `Accelerate ${focus.name}`,
        startDate,
      ),
    );
  }
  scenarios.push(scenario(open, monthlySurplus, open.map(() => 1), 'Balanced', startDate));
  return scenarios;
}

/** A single custom split (e.g. from the UI slider). Weights need not be normalized. */
export function allocateCustom(
  goals: Goal[],
  monthlySurplus: Cents,
  weights: number[],
  startDate: Date,
): AllocationScenario {
  if (weights.length !== goals.length) throw new Error('weights must match goals length');
  return scenario(goals, monthlySurplus, weights, 'Custom', startDate);
}

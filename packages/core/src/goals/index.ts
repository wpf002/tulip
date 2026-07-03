import { type Cents } from '../money/index.js';

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
  /** goalId -> monthly contribution in cents. */
  perGoalMonthly: Record<string, Cents>;
  /** goalId -> projected completion date (ISO). */
  projectedDates: Record<string, string>;
}

/**
 * Model competing goals sharing one pool of dollars and return the tradeoff frontier
 * (accelerate A vs balance vs accelerate B). Pure + deterministic.
 *
 * ROADMAP (Phase 3): full frontier generation from a monthly-surplus constraint,
 * priority-weighted allocation via money.allocate(), and date recomputation per slider step.
 */
export function resolveGoalConflict(_goals: Goal[], _monthlySurplus: Cents): AllocationScenario[] {
  // Implemented in Phase 3 against the spec in CLAUDE.md.
  return [];
}

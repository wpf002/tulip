import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AccountType, DebtType, GoalType, prisma, type Goal as DbGoal } from '@tulip/db';
import {
  cents,
  resolveGoalConflict,
  allocateCustom,
  routeNextDollar,
  type Goal,
  type RouterProfile,
} from '@tulip/core';

const bpsToDecimal = (bps: number) => bps / 10000;

const GOAL_COLORS: Record<GoalType, string> = {
  DEBT_PAYOFF: 'red',
  PROPERTY: 'green',
  EMERGENCY_FUND: 'white',
  RETIREMENT: 'purple',
  SAVINGS: 'green',
  CUSTOM: 'green',
};

function serializeGoal(g: DbGoal) {
  return {
    id: g.id,
    name: g.name,
    type: g.type,
    targetCents: Number(g.targetCents),
    savedCents: Number(g.savedCents),
    targetDate: g.targetDate.toISOString().slice(0, 10),
    priority: g.priority,
    colorTag: g.colorTag ?? GOAL_COLORS[g.type],
    shared: g.shared,
  };
}

function toEngineGoal(g: DbGoal): Goal {
  return {
    id: g.id,
    name: g.name,
    target: cents(Number(g.targetCents)),
    saved: cents(Number(g.savedCents)),
    targetDate: g.targetDate.toISOString().slice(0, 10),
    priority: g.priority,
  };
}

const goalBodySchema = z.object({
  name: z.string().min(1).max(120),
  type: z.nativeEnum(GoalType),
  targetCents: z.number().int().positive(),
  savedCents: z.number().int().nonnegative().optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  priority: z.number().int().min(1).max(10).optional(),
  shared: z.boolean().optional(),
});

const resolveQuerySchema = z.object({
  surplusCents: z.coerce.number().int().positive(),
});

const customResolveSchema = z.object({
  surplusCents: z.number().int().positive(),
  weights: z.array(z.number().nonnegative()).min(1),
});

export async function goalRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (req) => {
    const goals = await prisma.goal.findMany({
      where: { userId: req.user.sub },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    return { goals: goals.map(serializeGoal) };
  });

  app.post('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = goalBodySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const g = parsed.data;
    const goal = await prisma.goal.create({
      data: {
        userId: req.user.sub,
        name: g.name,
        type: g.type,
        targetCents: BigInt(g.targetCents),
        savedCents: BigInt(g.savedCents ?? 0),
        targetDate: new Date(`${g.targetDate}T00:00:00Z`),
        priority: g.priority ?? 5,
        colorTag: GOAL_COLORS[g.type],
      },
    });
    return reply.status(201).send({ goal: serializeGoal(goal) });
  });

  app.patch('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = goalBodySchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const existing = await prisma.goal.findFirst({ where: { id, userId: req.user.sub } });
    if (!existing) return reply.status(404).send({ error: 'Goal not found' });

    const g = parsed.data;
    const goal = await prisma.goal.update({
      where: { id },
      data: {
        ...(g.name !== undefined ? { name: g.name } : {}),
        ...(g.type !== undefined ? { type: g.type, colorTag: GOAL_COLORS[g.type] } : {}),
        ...(g.targetCents !== undefined ? { targetCents: BigInt(g.targetCents) } : {}),
        ...(g.savedCents !== undefined ? { savedCents: BigInt(g.savedCents) } : {}),
        ...(g.targetDate !== undefined ? { targetDate: new Date(`${g.targetDate}T00:00:00Z`) } : {}),
        ...(g.priority !== undefined ? { priority: g.priority } : {}),
        ...(g.shared !== undefined ? { shared: g.shared } : {}),
      },
    });
    return { goal: serializeGoal(goal) };
  });

  app.delete('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.goal.findFirst({ where: { id, userId: req.user.sub } });
    if (!existing) return reply.status(404).send({ error: 'Goal not found' });
    await prisma.goal.delete({ where: { id } });
    return reply.status(204).send();
  });

  /** Tradeoff frontier: accelerate-A / balanced / accelerate-B over open goals. */
  app.get('/resolve', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = resolveQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const goals = await prisma.goal.findMany({ where: { userId: req.user.sub } });
    const scenarios = resolveGoalConflict(
      goals.map(toEngineGoal),
      cents(parsed.data.surplusCents),
      new Date(),
    );
    return { scenarios };
  });

  /** Custom weights from the UI slider — recomputes every projected date. */
  app.post('/resolve', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = customResolveSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const goals = await prisma.goal.findMany({
      where: { userId: req.user.sub },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    const open = goals.filter((g) => g.targetCents > g.savedCents);
    if (open.length !== parsed.data.weights.length) {
      return reply.status(400).send({
        error: `weights length (${parsed.data.weights.length}) must match open goals (${open.length})`,
      });
    }
    if (parsed.data.weights.every((w) => w === 0)) {
      return reply.status(400).send({ error: 'At least one weight must be positive' });
    }

    const scenario = allocateCustom(
      open.map(toEngineGoal),
      cents(parsed.data.surplusCents),
      parsed.data.weights,
      new Date(),
    );
    return { scenario, goalOrder: open.map((g) => g.id) };
  });
}

// ---------------------------------------------------------------------------

const routerBodySchema = z.object({
  amountCents: z.number().int().positive(),
  marginalTaxRate: z.number().min(0).max(1).default(0.24),
  expectedMarketReturn: z.number().min(0).max(0.2).default(0.07),
  employerMatch: z
    .object({
      matchRate: z.number().min(0).max(2),
      remainingMatchableContributionCents: z.number().int().nonnegative(),
    })
    .optional(),
  emergencyFund: z
    .object({
      floorCents: z.number().int().positive(),
      savingsApr: z.number().min(0).max(0.2).default(0.04),
    })
    .optional(),
  retirement: z
    .object({
      kind: z.enum(['ROTH', 'TRADITIONAL']),
      label: z.string().max(80).default('Retirement account'),
      remainingCapacityCents: z.number().int().positive(),
    })
    .optional(),
  taxableInvesting: z.boolean().default(true),
});

export async function routerRoutes(app: FastifyInstance) {
  /**
   * POST /router/next-dollar — "where should my next $X go?"
   * Debts and savings balances come from the DB; employer match, retirement
   * capacity, and rates are supplied by the caller (not yet aggregatable).
   */
  app.post('/next-dollar', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = routerBodySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const body = parsed.data;

    const [debts, savingsAgg] = await prisma.$transaction([
      prisma.debt.findMany({ where: { userId: req.user.sub, balanceCents: { gt: 0n } } }),
      prisma.account.aggregate({
        where: { userId: req.user.sub, type: { in: [AccountType.SAVINGS, AccountType.CASH] } },
        _sum: { balanceCents: true },
      }),
    ]);

    const profile: RouterProfile = {
      marginalTaxRate: body.marginalTaxRate,
      expectedMarketReturn: body.expectedMarketReturn,
      debts: debts.map((d) => ({
        id: d.id,
        name: d.name,
        aprAnnual: bpsToDecimal(d.aprBps),
        balance: cents(Number(d.balanceCents)),
        isMortgage: d.type === DebtType.MORTGAGE,
      })),
      taxableInvesting: body.taxableInvesting,
      ...(body.employerMatch
        ? {
            employerMatch: {
              matchRate: body.employerMatch.matchRate,
              remainingMatchableContribution: cents(body.employerMatch.remainingMatchableContributionCents),
            },
          }
        : {}),
      ...(body.emergencyFund
        ? {
            emergencyFund: {
              current: cents(Number(savingsAgg._sum.balanceCents ?? 0n)),
              floor: cents(body.emergencyFund.floorCents),
              savingsApr: body.emergencyFund.savingsApr,
            },
          }
        : {}),
      ...(body.retirement
        ? {
            retirement: {
              kind: body.retirement.kind,
              label: body.retirement.label,
              remainingCapacity: cents(body.retirement.remainingCapacityCents),
            },
          }
        : {}),
    };

    const routed = routeNextDollar(cents(body.amountCents), profile);
    return {
      routed: routed.map((r) => ({
        kind: r.opportunity.kind,
        label: r.opportunity.label,
        effectiveReturn: r.opportunity.effectiveReturn,
        amountCents: Number(r.amount),
        projectedAnnualValueCents: Number(r.projectedAnnualValue),
        rationale: r.rationale,
        targetId: r.opportunity.targetId ?? null,
      })),
    };
  });
}

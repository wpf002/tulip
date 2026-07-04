import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DebtType, prisma } from '@tulip/db';
import {
  cents,
  detectSurplus,
  sweepDebtFreeDelta,
  routeNextDollar,
  type CategoryBudget,
  type Loan,
  type RouterProfile,
} from '@tulip/core';

const bpsToDecimal = (bps: number) => bps / 10000;

const budgetBodySchema = z.object({
  category: z.string().min(1).max(64),
  monthlyLimitCents: z.number().int().positive(),
});

function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Month-to-date outflow per category (transactions are negative for outflow). */
async function spendByCategory(userId: string, since: Date): Promise<Map<string, number>> {
  const grouped = await prisma.transaction.groupBy({
    by: ['category'],
    where: { userId, postedAt: { gte: since }, amountCents: { lt: 0n } },
    _sum: { amountCents: true },
  });
  const map = new Map<string, number>();
  for (const g of grouped) {
    map.set(g.category ?? 'Uncategorized', Number(-(g._sum.amountCents ?? 0n)));
  }
  return map;
}

async function budgetStatus(userId: string) {
  const [budgets, spend] = await Promise.all([
    prisma.budget.findMany({ where: { userId }, orderBy: { category: 'asc' } }),
    spendByCategory(userId, monthStart(new Date())),
  ]);
  return budgets.map((b) => {
    const spent = spend.get(b.category) ?? 0;
    const limit = Number(b.monthlyLimitCents);
    return {
      id: b.id,
      category: b.category,
      monthlyLimitCents: limit,
      spentCents: spent,
      remainingCents: Math.max(0, limit - spent),
      overCents: Math.max(0, spent - limit),
    };
  });
}

export async function budgetRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (req) => {
    return { budgets: await budgetStatus(req.user.sub) };
  });

  app.post('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = budgetBodySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const budget = await prisma.budget.upsert({
      where: { userId_category: { userId: req.user.sub, category: parsed.data.category } },
      update: { monthlyLimitCents: BigInt(parsed.data.monthlyLimitCents) },
      create: {
        userId: req.user.sub,
        category: parsed.data.category,
        monthlyLimitCents: BigInt(parsed.data.monthlyLimitCents),
      },
    });
    return reply.status(201).send({
      budget: { id: budget.id, category: budget.category, monthlyLimitCents: Number(budget.monthlyLimitCents) },
    });
  });

  app.delete('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.budget.findFirst({ where: { id, userId: req.user.sub } });
    if (!existing) return reply.status(404).send({ error: 'Budget not found' });
    await prisma.budget.delete({ where: { id } });
    return reply.status(204).send();
  });
}

// ---------------------------------------------------------------------------

const applySchema = z
  .object({
    amountCents: z.number().int().positive(),
    goalId: z.string().optional(),
    debtId: z.string().optional(),
  })
  .refine((v) => Boolean(v.goalId) !== Boolean(v.debtId), {
    message: 'Provide exactly one of goalId or debtId',
  });

export async function reallocateRoutes(app: FastifyInstance) {
  /**
   * GET /reallocate/suggest — this month's sweepable surplus, the router's top
   * destination for it, and (when that destination is a debt) the exact
   * debt-free-date acceleration.
   */
  app.get('/suggest', { preHandler: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const status = await budgetStatus(userId);
    const surplus = detectSurplus(
      status.map(
        (b): CategoryBudget => ({
          category: b.category,
          monthlyLimit: cents(b.monthlyLimitCents),
          spentSoFar: cents(b.spentCents),
        }),
      ),
    );

    if (surplus.total <= 0) {
      return { surplusCents: 0, perCategory: [], destination: null, debtFreeDelta: null };
    }

    const debts = await prisma.debt.findMany({
      where: { userId, balanceCents: { gt: 0n }, type: { not: DebtType.MORTGAGE } },
    });
    const profile: RouterProfile = {
      marginalTaxRate: 0.24,
      expectedMarketReturn: 0.07,
      debts: debts.map((d) => ({
        id: d.id,
        name: d.name,
        aprAnnual: bpsToDecimal(d.aprBps),
        balance: cents(Number(d.balanceCents)),
      })),
      taxableInvesting: true,
    };
    const routed = routeNextDollar(surplus.total, profile);
    const top = routed[0] ?? null;

    let debtFreeDelta = null;
    if (top && top.opportunity.targetId && debts.length > 0) {
      const loans: Loan[] = debts.map((d) => ({
        id: d.id,
        name: d.name,
        balance: cents(Number(d.balanceCents)),
        aprAnnual: bpsToDecimal(d.aprBps),
        minPayment: cents(Number(d.minPaymentCents)),
      }));
      const delta = sweepDebtFreeDelta(loans, cents(0), surplus.total, 'avalanche', new Date());
      debtFreeDelta = {
        baselineDebtFreeDate: delta.baselineDebtFreeDate,
        sweptDebtFreeDate: delta.sweptDebtFreeDate,
        monthsSooner: delta.monthsSooner,
        interestSavedCents: Number(delta.interestSaved),
      };
    }

    return {
      surplusCents: Number(surplus.total),
      perCategory: surplus.perCategory.map((c) => ({ category: c.category, surplusCents: Number(c.surplus) })),
      destination: top
        ? {
            kind: top.opportunity.kind,
            label: top.opportunity.label,
            targetId: top.opportunity.targetId ?? null,
            amountCents: Number(top.amount),
            rationale: top.rationale,
          }
        : null,
      debtFreeDelta,
    };
  });

  /**
   * POST /reallocate/apply — commit the sweep: a goal contribution or a debt
   * paydown. LOCKED INVARIANT: the multi-row money mutation is one $transaction.
   */
  app.post('/apply', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = applySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const { amountCents, goalId, debtId } = parsed.data;
    const userId = req.user.sub;
    const amount = BigInt(amountCents);

    if (goalId) {
      const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } });
      if (!goal) return reply.status(404).send({ error: 'Goal not found' });
      const [updated] = await prisma.$transaction([
        prisma.goal.update({ where: { id: goalId }, data: { savedCents: { increment: amount } } }),
      ]);
      return { applied: amountCents, goal: { id: updated.id, savedCents: Number(updated.savedCents) } };
    }

    const debt = await prisma.debt.findFirst({ where: { id: debtId!, userId } });
    if (!debt) return reply.status(404).send({ error: 'Debt not found' });
    const pay = amount > debt.balanceCents ? debt.balanceCents : amount;
    const [updated] = await prisma.$transaction([
      prisma.debt.update({ where: { id: debt.id }, data: { balanceCents: { decrement: pay } } }),
    ]);
    return { applied: Number(pay), debt: { id: updated.id, balanceCents: Number(updated.balanceCents) } };
  });
}

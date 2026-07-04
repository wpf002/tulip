import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AccountType, prisma } from '@tulip/db';
import { cents, computeHealthScore } from '@tulip/core';

const LIQUID_TYPES = [AccountType.CHECKING, AccountType.SAVINGS, AccountType.CASH];

const querySchema = z.object({
  /** Overrides for figures not yet derivable from linked data. */
  monthlyIncomeCents: z.coerce.number().int().nonnegative().optional(),
  monthlyExpensesCents: z.coerce.number().int().nonnegative().optional(),
  monthlySavingsCents: z.coerce.number().int().nonnegative().optional(),
});

export async function healthScoreRoutes(app: FastifyInstance) {
  app.get('/score', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const userId = req.user.sub;

    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const windowStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const [liquidAgg, debts, inflowAgg, outflowAgg, snapshots] = await prisma.$transaction([
      prisma.account.aggregate({
        where: { userId, type: { in: LIQUID_TYPES } },
        _sum: { balanceCents: true },
      }),
      prisma.debt.findMany({ where: { userId, balanceCents: { gt: 0n } } }),
      prisma.transaction.aggregate({
        where: { userId, postedAt: { gte: monthAgo }, amountCents: { gt: 0n } },
        _sum: { amountCents: true },
      }),
      prisma.transaction.aggregate({
        where: { userId, postedAt: { gte: monthAgo }, amountCents: { lt: 0n } },
        _sum: { amountCents: true },
      }),
      prisma.netWorthSnapshot.findMany({
        where: { userId, capturedAt: { gte: windowStart } },
        orderBy: { capturedAt: 'asc' },
      }),
    ]);

    const totalDebt = debts.reduce((s, d) => s + Number(d.balanceCents), 0);
    const weightedDebtRate =
      totalDebt > 0
        ? debts.reduce((s, d) => s + Number(d.balanceCents) * (d.aprBps / 10000), 0) / totalDebt
        : 0;

    const derivedIncome = Number(inflowAgg._sum.amountCents ?? 0n);
    const derivedExpenses = Number(-(outflowAgg._sum.amountCents ?? 0n));
    const monthlyIncomeCents = parsed.data.monthlyIncomeCents ?? derivedIncome;
    const monthlyExpensesCents = parsed.data.monthlyExpensesCents ?? derivedExpenses;
    const monthlySavingsCents =
      parsed.data.monthlySavingsCents ?? Math.max(0, monthlyIncomeCents - monthlyExpensesCents);

    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const netWorthTrendCents =
      first && last ? Number(last.netWorthCents - first.netWorthCents) : 0;

    const result = computeHealthScore({
      liquidCents: cents(Number(liquidAgg._sum.balanceCents ?? 0n)),
      monthlyExpensesCents: cents(monthlyExpensesCents),
      monthlyIncomeCents: cents(monthlyIncomeCents),
      monthlySavingsCents: cents(monthlySavingsCents),
      totalDebtCents: cents(totalDebt),
      weightedDebtRate,
      netWorthTrendCents: cents(netWorthTrendCents),
    });

    return {
      score: result.score,
      subscores: result.subscores,
      drivers: {
        emergencyFundMonths: result.drivers.emergencyFundMonths,
        annualInterestLoadCents: Number(result.drivers.annualInterestLoadCents),
        interestToIncomeRatio: result.drivers.interestToIncomeRatio,
        savingsRate: result.drivers.savingsRate,
        trendToMonthlyIncomeRatio: result.drivers.trendToMonthlyIncomeRatio,
        weightedDebtRate,
        totalDebtCents: totalDebt,
      },
      inputsUsed: { monthlyIncomeCents, monthlyExpensesCents, monthlySavingsCents },
    };
  });
}

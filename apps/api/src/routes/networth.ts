import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AccountType, prisma } from '@tulip/db';

const ASSET_TYPES = [
  AccountType.CHECKING,
  AccountType.SAVINGS,
  AccountType.INVESTMENT,
  AccountType.RETIREMENT,
  AccountType.CASH,
];
const LIABILITY_TYPES = [AccountType.CREDIT_CARD, AccountType.LOAN];

export interface NetWorthBreakdown {
  netWorthCents: bigint;
  assetsCents: bigint;
  liabilitiesCents: bigint;
}

/**
 * assets = asset-account balances + property values
 * liabilities = liability-account balances + Debt balances + property mortgage balances
 * (equivalent to counting property *equity* as the asset). Track a given mortgage
 * either on the Property row or as a Debt — not both — to avoid double counting.
 */
export async function computeNetWorth(userId: string): Promise<NetWorthBreakdown> {
  const [assetAgg, liabAgg, debtAgg, propAgg] = await prisma.$transaction([
    prisma.account.aggregate({
      where: { userId, type: { in: ASSET_TYPES } },
      _sum: { balanceCents: true },
    }),
    prisma.account.aggregate({
      where: { userId, type: { in: LIABILITY_TYPES } },
      _sum: { balanceCents: true },
    }),
    prisma.debt.aggregate({ where: { userId }, _sum: { balanceCents: true } }),
    prisma.property.aggregate({
      where: { userId },
      _sum: { estimatedValueCents: true, mortgageBalanceCents: true },
    }),
  ]);

  const assetsCents =
    (assetAgg._sum.balanceCents ?? 0n) + (propAgg._sum.estimatedValueCents ?? 0n);
  const liabilitiesCents =
    (liabAgg._sum.balanceCents ?? 0n) +
    (debtAgg._sum.balanceCents ?? 0n) +
    (propAgg._sum.mortgageBalanceCents ?? 0n);

  return { netWorthCents: assetsCents - liabilitiesCents, assetsCents, liabilitiesCents };
}

/** One snapshot per user per calendar day (UTC); a later capture replaces the day's row. */
export async function captureNetWorthSnapshot(userId: string): Promise<void> {
  const breakdown = await computeNetWorth(userId);
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  await prisma.$transaction([
    prisma.netWorthSnapshot.deleteMany({ where: { userId, capturedAt: { gte: dayStart } } }),
    prisma.netWorthSnapshot.create({
      data: {
        userId,
        netWorthCents: breakdown.netWorthCents,
        assetsCents: breakdown.assetsCents,
        liabilitiesCents: breakdown.liabilitiesCents,
      },
    }),
  ]);
}

const querySchema = z.object({ days: z.coerce.number().int().min(1).max(3650).default(90) });

export async function netWorthRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const userId = req.user.sub;
    const breakdown = await computeNetWorth(userId);

    // Keep the trend alive even on days with no sync.
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const today = await prisma.netWorthSnapshot.findFirst({
      where: { userId, capturedAt: { gte: dayStart } },
    });
    if (!today) await captureNetWorthSnapshot(userId);

    const since = new Date(Date.now() - parsed.data.days * 24 * 60 * 60 * 1000);
    const snapshots = await prisma.netWorthSnapshot.findMany({
      where: { userId, capturedAt: { gte: since } },
      orderBy: { capturedAt: 'asc' },
    });

    return {
      netWorthCents: Number(breakdown.netWorthCents),
      assetsCents: Number(breakdown.assetsCents),
      liabilitiesCents: Number(breakdown.liabilitiesCents),
      series: snapshots.map((s) => ({
        date: s.capturedAt.toISOString().slice(0, 10),
        netWorthCents: Number(s.netWorthCents),
      })),
    };
  });
}

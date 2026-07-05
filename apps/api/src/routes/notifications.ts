import type { FastifyInstance } from 'fastify';
import { prisma } from '@tulip/db';
import { budgetStatus, computeSweepSuggestion } from './budgets.js';

/**
 * Proactive triggers. Detectors run on demand (every GET /notifications) and
 * dedupe via (userId, dedupeKey) so each nudge fires once per month/event.
 */

const monthKey = (d = new Date()) => d.toISOString().slice(0, 7); // "2026-07"

async function createIfNew(
  userId: string,
  n: { type: string; title: string; body: string; actionUrl?: string; dedupeKey: string },
) {
  await prisma.notification
    .create({
      data: {
        userId,
        type: n.type,
        title: n.title,
        body: n.body,
        actionUrl: n.actionUrl ?? null,
        dedupeKey: n.dedupeKey,
      },
    })
    .catch(() => undefined); // unique(userId, dedupeKey) hit — already nudged
}

const usd = (c: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c / 100);

async function runDetectors(userId: string): Promise<void> {
  const month = monthKey();

  // 1) Under budget → sweep suggestion with the exact debt-free acceleration.
  const sweep = await computeSweepSuggestion(userId);
  if (sweep.surplusCents > 0 && sweep.destination) {
    const delta = sweep.debtFreeDelta;
    await createIfNew(userId, {
      type: 'SWEEP_SUGGESTION',
      title: `You're ${usd(sweep.surplusCents)} under budget`,
      body: delta && delta.monthsSooner > 0
        ? `Sweep it to ${sweep.destination.label} — debt-free ${delta.monthsSooner} months sooner, saving ${usd(delta.interestSavedCents)} in interest.`
        : `Sweep it to ${sweep.destination.label} (${sweep.destination.rationale}).`,
      actionUrl: '/budget',
      dedupeKey: `sweep-${month}`,
    });
  }

  // 2) Over budget in any category.
  const budgets = await budgetStatus(userId);
  for (const b of budgets) {
    if (b.overCents > 0) {
      await createIfNew(userId, {
        type: 'OVER_BUDGET',
        title: `${b.category} is over budget`,
        body: `You've spent ${usd(b.spentCents)} of the ${usd(b.monthlyLimitCents)} ${b.category} budget — ${usd(b.overCents)} over.`,
        actionUrl: '/budget',
        dedupeKey: `overbudget-${b.category}-${month}`,
      });
    }
  }

  // 3) A goal crossed the finish line.
  const goals = await prisma.goal.findMany({ where: { userId } });
  for (const g of goals.filter((g) => g.savedCents >= g.targetCents)) {
    await createIfNew(userId, {
      type: 'GOAL_REACHED',
      title: `Goal reached: ${g.name}`,
      body: `You've saved ${usd(Number(g.savedCents))} — the full target. Time to plant the next one.`,
      actionUrl: '/goals',
      dedupeKey: `goal-reached-${g.id}`,
    });
  }
}

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (req) => {
    await runDetectors(req.user.sub);
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return {
      unreadCount: notifications.filter((n) => !n.readAt).length,
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        actionUrl: n.actionUrl,
        read: Boolean(n.readAt),
        createdAt: n.createdAt,
      })),
    };
  });

  app.post('/:id/read', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const updated = await prisma.notification.updateMany({
      where: { id, userId: req.user.sub, readAt: null },
      data: { readAt: new Date() },
    });
    if (updated.count === 0) return reply.status(404).send({ error: 'Not found or already read' });
    return { read: true };
  });

  app.post('/read-all', { preHandler: [app.authenticate] }, async (req) => {
    await prisma.notification.updateMany({
      where: { userId: req.user.sub, readAt: null },
      data: { readAt: new Date() },
    });
    return { read: true };
  });
}

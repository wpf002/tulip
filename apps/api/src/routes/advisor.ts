import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { prisma } from '@tulip/db';
import { computeNetWorth } from './networth.js';

/**
 * Advisor side. Access is client-granted and view-only by construction:
 * advisors get exactly one aggregate GET endpoint — no mutation route ever
 * receives a client id.
 */

const redeemSchema = z.object({ code: z.string().min(4).max(32) });

export async function advisorRoutes(app: FastifyInstance) {
  /** CLIENT: mint a one-time code that grants an advisor view-only access. */
  app.post('/grant-code', { preHandler: [app.authenticate] }, async (req) => {
    const codeValue = randomBytes(4).toString('hex');
    await prisma.user.update({ where: { id: req.user.sub }, data: { advisorInviteCode: codeValue } });
    return { code: codeValue };
  });

  /** CLIENT: who can see my finances? */
  app.get('/grants', { preHandler: [app.authenticate] }, async (req) => {
    const grants = await prisma.advisorAccess.findMany({
      where: { clientId: req.user.sub },
      include: { advisor: { select: { email: true } } },
    });
    return { advisors: grants.map((g) => ({ advisorId: g.advisorId, email: g.advisor.email, since: g.createdAt })) };
  });

  /** CLIENT: revoke an advisor. */
  app.delete('/grants/:advisorId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { advisorId } = req.params as { advisorId: string };
    const deleted = await prisma.advisorAccess.deleteMany({
      where: { clientId: req.user.sub, advisorId },
    });
    if (deleted.count === 0) return reply.status(404).send({ error: 'No such grant' });
    return { revoked: true };
  });

  /** ADVISOR: redeem a client's code to join their roster. */
  app.post('/clients', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = redeemSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const client = await prisma.user.findUnique({ where: { advisorInviteCode: parsed.data.code } });
    if (!client) return reply.status(404).send({ error: 'Invalid access code' });
    if (client.id === req.user.sub) return reply.status(400).send({ error: 'You cannot advise yourself' });

    // One-time code: consume it and create the standing grant atomically.
    await prisma.$transaction([
      prisma.advisorAccess.upsert({
        where: { advisorId_clientId: { advisorId: req.user.sub, clientId: client.id } },
        update: {},
        create: { advisorId: req.user.sub, clientId: client.id },
      }),
      prisma.user.update({ where: { id: client.id }, data: { advisorInviteCode: null } }),
    ]);
    return reply.status(201).send({ client: { id: client.id, email: client.email } });
  });

  /** ADVISOR: roster with headline numbers. */
  app.get('/clients', { preHandler: [app.authenticate] }, async (req) => {
    const links = await prisma.advisorAccess.findMany({
      where: { advisorId: req.user.sub },
      include: { client: { select: { id: true, email: true } } },
    });
    const clients = await Promise.all(
      links.map(async (l) => {
        const nw = await computeNetWorth(l.client.id);
        return {
          id: l.client.id,
          email: l.client.email,
          since: l.createdAt,
          netWorthCents: Number(nw.netWorthCents),
        };
      }),
    );
    return { clients };
  });

  /** ADVISOR: view-only client overview (read-only aggregate; no mutations exist). */
  app.get('/clients/:id/overview', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const link = await prisma.advisorAccess.findUnique({
      where: { advisorId_clientId: { advisorId: req.user.sub, clientId: id } },
    });
    if (!link) return reply.status(403).send({ error: 'No access to this client' });

    const [netWorth, debts, goals, accounts] = await Promise.all([
      computeNetWorth(id),
      prisma.debt.findMany({ where: { userId: id, balanceCents: { gt: 0n } } }),
      prisma.goal.findMany({ where: { userId: id } }),
      prisma.account.findMany({ where: { userId: id } }),
    ]);

    return {
      netWorth: {
        netWorthCents: Number(netWorth.netWorthCents),
        assetsCents: Number(netWorth.assetsCents),
        liabilitiesCents: Number(netWorth.liabilitiesCents),
      },
      accounts: accounts.map((a) => ({ name: a.name, type: a.type, balanceCents: Number(a.balanceCents) })),
      debts: debts.map((d) => ({
        name: d.name,
        type: d.type,
        balanceCents: Number(d.balanceCents),
        aprBps: d.aprBps,
        minPaymentCents: Number(d.minPaymentCents),
      })),
      goals: goals.map((g) => ({
        name: g.name,
        type: g.type,
        targetCents: Number(g.targetCents),
        savedCents: Number(g.savedCents),
        targetDate: g.targetDate.toISOString().slice(0, 10),
      })),
    };
  });

  /** ADVISOR: drop a client from the roster. */
  app.delete('/clients/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const deleted = await prisma.advisorAccess.deleteMany({
      where: { advisorId: req.user.sub, clientId: id },
    });
    if (deleted.count === 0) return reply.status(404).send({ error: 'Not on your roster' });
    return { removed: true };
  });
}

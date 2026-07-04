import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { prisma } from '@tulip/db';

const createSchema = z.object({ name: z.string().min(1).max(80) });
const joinSchema = z.object({ code: z.string().min(4).max(32) });

const code = () => randomBytes(4).toString('hex'); // 8 chars, e.g. "3f9b5c2e"

export async function householdRoutes(app: FastifyInstance) {
  /** Current household: members plus everything shared with you. */
  app.get('/', { preHandler: [app.authenticate] }, async (req) => {
    const me = await prisma.user.findUnique({
      where: { id: req.user.sub },
      include: { household: { include: { members: { select: { id: true, email: true } } } } },
    });
    if (!me?.household) return { household: null };

    const memberIds = me.household.members.map((m) => m.id).filter((id) => id !== me.id);
    const [sharedGoals, sharedBudgets] = await prisma.$transaction([
      prisma.goal.findMany({
        where: { userId: { in: memberIds }, shared: true },
        include: { user: { select: { email: true } } },
      }),
      prisma.budget.findMany({
        where: { userId: { in: memberIds }, shared: true },
        include: { user: { select: { email: true } } },
      }),
    ]);

    return {
      household: {
        id: me.household.id,
        name: me.household.name,
        inviteCode: me.household.inviteCode,
        members: me.household.members.map((m) => ({ id: m.id, email: m.email, you: m.id === me.id })),
      },
      sharedWithYou: {
        goals: sharedGoals.map((g) => ({
          id: g.id,
          name: g.name,
          type: g.type,
          targetCents: Number(g.targetCents),
          savedCents: Number(g.savedCents),
          targetDate: g.targetDate.toISOString().slice(0, 10),
          owner: g.user.email,
        })),
        budgets: sharedBudgets.map((b) => ({
          id: b.id,
          category: b.category,
          monthlyLimitCents: Number(b.monthlyLimitCents),
          owner: b.user.email,
        })),
      },
    };
  });

  app.post('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const me = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (me?.householdId) return reply.status(409).send({ error: 'Leave your current household first' });

    const household = await prisma.household.create({
      data: { name: parsed.data.name, inviteCode: code(), members: { connect: { id: req.user.sub } } },
    });
    return reply.status(201).send({ id: household.id, name: household.name, inviteCode: household.inviteCode });
  });

  app.post('/join', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = joinSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const me = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (me?.householdId) return reply.status(409).send({ error: 'Leave your current household first' });

    const household = await prisma.household.findUnique({ where: { inviteCode: parsed.data.code } });
    if (!household) return reply.status(404).send({ error: 'Invalid invite code' });

    await prisma.user.update({ where: { id: req.user.sub }, data: { householdId: household.id } });
    return { joined: household.name };
  });

  app.post('/leave', { preHandler: [app.authenticate] }, async (req) => {
    await prisma.user.update({ where: { id: req.user.sub }, data: { householdId: null } });
    return { left: true };
  });
}

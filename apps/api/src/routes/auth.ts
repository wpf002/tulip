import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@tulip/db';

const BCRYPT_COST = 12;
const TOKEN_TTL = '24h';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (req, reply) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { email, password } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return reply.status(409).send({ error: 'An account with that email already exists' });

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const user = await prisma.user.create({ data: { email, passwordHash } });

    const token = app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: TOKEN_TTL });
    return reply.status(201).send({ token, user: { id: user.id, email: user.email } });
  });

  app.post('/login', async (req, reply) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (parsed.success === false) return reply.status(400).send({ error: parsed.error.flatten() });

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    // Same error for unknown email and bad password — don't leak which emails exist.
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: TOKEN_TTL });
    return { token, user: { id: user.id, email: user.email } };
  });

  app.get('/me', { preHandler: [app.authenticate] }, async (req) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, email: true, createdAt: true },
    });
    return { user };
  });
}

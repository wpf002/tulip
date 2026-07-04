import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { healthRoutes } from './routes/health.js';
import { debtRoutes } from './routes/debt.js';
import { authRoutes } from './routes/auth.js';
import { accountRoutes, transactionRoutes } from './routes/accounts.js';
import { netWorthRoutes } from './routes/networth.js';
import { plaidPlugin } from './plugins/plaid.js';
import { registerAuthenticate } from './plugins/authenticate.js';

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: process.env.JWT_SECRET ?? 'dev-secret-change-me' });
  registerAuthenticate(app);

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(plaidPlugin);
  await app.register(accountRoutes, { prefix: '/accounts' });
  await app.register(transactionRoutes, { prefix: '/transactions' });
  await app.register(netWorthRoutes, { prefix: '/networth' });
  await app.register(debtRoutes, { prefix: '/debt' });

  // ROADMAP: goals, router, budget, property, flint
  return app;
}

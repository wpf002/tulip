import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { healthRoutes } from './routes/health.js';
import { debtRoutes } from './routes/debt.js';
import { authRoutes } from './routes/auth.js';
import { accountRoutes, transactionRoutes } from './routes/accounts.js';
import { netWorthRoutes } from './routes/networth.js';
import { goalRoutes, routerRoutes } from './routes/goals.js';
import { budgetRoutes, reallocateRoutes } from './routes/budgets.js';
import { propertyRoutes } from './routes/property.js';
import { healthScoreRoutes } from './routes/health-score.js';
import { flintRoutes } from './routes/flint.js';
import { householdRoutes } from './routes/household.js';
import { advisorRoutes } from './routes/advisor.js';
import { notificationRoutes } from './routes/notifications.js';
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
  await app.register(goalRoutes, { prefix: '/goals' });
  await app.register(routerRoutes, { prefix: '/router' });
  await app.register(budgetRoutes, { prefix: '/budgets' });
  await app.register(reallocateRoutes, { prefix: '/reallocate' });
  await app.register(propertyRoutes, { prefix: '/property' });
  await app.register(healthScoreRoutes, { prefix: '/health' });
  await app.register(flintRoutes, { prefix: '/flint' });
  await app.register(householdRoutes, { prefix: '/household' });
  await app.register(advisorRoutes, { prefix: '/advisor' });
  await app.register(notificationRoutes, { prefix: '/notifications' });

  return app;
}

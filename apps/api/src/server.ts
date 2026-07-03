import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { healthRoutes } from './routes/health.js';
import { debtRoutes } from './routes/debt.js';

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: process.env.JWT_SECRET ?? 'dev-secret-change-me' });

  await app.register(healthRoutes);
  await app.register(debtRoutes, { prefix: '/debt' });

  // ROADMAP: auth (bcryptjs cost 12 + @fastify/jwt 24h), accounts, plaid, goals, router, budget, property, flint
  return app;
}

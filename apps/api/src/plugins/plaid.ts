import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from 'plaid';
import { prisma } from '@tulip/db';
import { encryptSecret } from '../lib/crypto.js';

export function buildPlaidClient(): PlaidApi {
  const env = process.env.PLAID_ENV ?? 'sandbox';
  return new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[env] ?? PlaidEnvironments['sandbox']!,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID ?? '',
          'PLAID-SECRET': process.env.PLAID_SECRET ?? '',
        },
      },
    }),
  );
}

declare module 'fastify' {
  interface FastifyInstance {
    plaid: PlaidApi;
  }
}

const exchangeSchema = z.object({
  publicToken: z.string().min(1),
  institutionName: z.string().optional(),
});

export async function plaidPlugin(app: FastifyInstance) {
  app.decorate('plaid', buildPlaidClient());

  const plaidConfigured = () =>
    Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);

  app.post('/plaid/link-token', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (!plaidConfigured()) {
      return reply.status(503).send({ error: 'Plaid is not configured (set PLAID_CLIENT_ID / PLAID_SECRET)' });
    }
    const res = await app.plaid.linkTokenCreate({
      user: { client_user_id: req.user.sub },
      client_name: 'Tulip',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    return { linkToken: res.data.link_token };
  });

  app.post('/plaid/exchange', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (!plaidConfigured()) {
      return reply.status(503).send({ error: 'Plaid is not configured (set PLAID_CLIENT_ID / PLAID_SECRET)' });
    }
    const parsed = exchangeSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const res = await app.plaid.itemPublicTokenExchange({
      public_token: parsed.data.publicToken,
    });

    // LOCKED INVARIANT: the access token is encrypted before it touches the DB.
    const item = await prisma.plaidItem.upsert({
      where: { plaidItemId: res.data.item_id },
      update: { encryptedAccessToken: encryptSecret(res.data.access_token) },
      create: {
        userId: req.user.sub,
        plaidItemId: res.data.item_id,
        encryptedAccessToken: encryptSecret(res.data.access_token),
        institutionName: parsed.data.institutionName ?? null,
      },
    });
    return { itemId: item.plaidItemId, institutionName: item.institutionName };
  });
}

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AccountType, prisma, type Prisma } from '@tulip/db';
import { decryptSecret } from '../lib/crypto.js';
import { captureNetWorthSnapshot } from './networth.js';

/** Plaid dollars (float at the wire) → integer cents, immediately. */
function plaidDollarsToCents(amount: number | null | undefined): bigint {
  return BigInt(Math.round((amount ?? 0) * 100));
}

function mapPlaidType(type: string | null, subtype: string | null): AccountType {
  if (type === 'depository') {
    if (subtype === 'savings') return AccountType.SAVINGS;
    if (subtype === 'cash management' || subtype === 'money market') return AccountType.CASH;
    return AccountType.CHECKING;
  }
  if (type === 'credit') return AccountType.CREDIT_CARD;
  if (type === 'investment' || type === 'brokerage') {
    const retirement = ['401k', '403b', '457b', 'ira', 'roth', 'roth 401k', 'sep ira', 'simple ira', 'pension'];
    return retirement.includes(subtype ?? '') ? AccountType.RETIREMENT : AccountType.INVESTMENT;
  }
  if (type === 'loan') return AccountType.LOAN;
  return AccountType.CHECKING;
}

export async function accountRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (req) => {
    const accounts = await prisma.account.findMany({
      where: { userId: req.user.sub },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    return {
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        institution: a.institution,
        balanceCents: Number(a.balanceCents),
        currency: a.currency,
        updatedAt: a.updatedAt,
      })),
    };
  });

  app.post('/sync', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const items = await prisma.plaidItem.findMany({ where: { userId } });
    if (items.length === 0) {
      return reply.status(400).send({ error: 'No linked bank connections. Link an account first.' });
    }

    let accountsSynced = 0;
    let transactionsSynced = 0;

    for (const item of items) {
      const accessToken = decryptSecret(item.encryptedAccessToken);

      const balanceRes = await app.plaid.accountsBalanceGet({ access_token: accessToken });

      // Pull the full transactions delta for this item before writing anything.
      const added: Prisma.TransactionUncheckedCreateInput[] = [];
      const removedIds: string[] = [];
      let cursor = item.syncCursor ?? undefined;
      let hasMore = true;
      const plaidAccountIdToLocal = new Map<string, string>();

      // Upsert accounts inside one transaction; collect their ids for txn rows.
      const accountWrites = balanceRes.data.accounts.map((acc) =>
        prisma.account.upsert({
          where: { plaidAccountId: acc.account_id },
          update: {
            balanceCents: plaidDollarsToCents(acc.balances.current),
            name: acc.name,
          },
          create: {
            userId,
            plaidItemId: item.plaidItemId,
            plaidAccountId: acc.account_id,
            name: acc.name,
            type: mapPlaidType(acc.type, acc.subtype),
            institution: item.institutionName,
            balanceCents: plaidDollarsToCents(acc.balances.current),
            currency: acc.balances.iso_currency_code ?? 'USD',
          },
        }),
      );
      const upsertedAccounts = await prisma.$transaction(accountWrites);
      accountsSynced += upsertedAccounts.length;
      for (const a of upsertedAccounts) {
        if (a.plaidAccountId) plaidAccountIdToLocal.set(a.plaidAccountId, a.id);
      }

      while (hasMore) {
        const txnRes = await app.plaid.transactionsSync({
          access_token: accessToken,
          ...(cursor ? { cursor } : {}),
          count: 500,
        });
        for (const t of [...txnRes.data.added, ...txnRes.data.modified]) {
          const accountId = plaidAccountIdToLocal.get(t.account_id);
          if (!accountId) continue;
          added.push({
            userId,
            accountId,
            plaidTxnId: t.transaction_id,
            // Plaid: positive = outflow. Tulip: negative = outflow.
            amountCents: -plaidDollarsToCents(t.amount),
            description: t.name,
            merchant: t.merchant_name ?? null,
            category: t.personal_finance_category?.primary ?? t.category?.[0] ?? null,
            postedAt: new Date(t.authorized_date ?? t.date),
            pending: t.pending,
          });
        }
        removedIds.push(...txnRes.data.removed.map((r) => r.transaction_id ?? '').filter(Boolean));
        cursor = txnRes.data.next_cursor;
        hasMore = txnRes.data.has_more;
      }

      // LOCKED INVARIANT: all money rows for this item land in one transaction.
      await prisma.$transaction([
        ...added.map((txn) =>
          prisma.transaction.upsert({
            where: { plaidTxnId: txn.plaidTxnId! },
            update: {
              amountCents: txn.amountCents,
              description: txn.description,
              pending: txn.pending ?? false,
              postedAt: txn.postedAt,
            },
            create: txn,
          }),
        ),
        ...(removedIds.length
          ? [prisma.transaction.deleteMany({ where: { plaidTxnId: { in: removedIds } } })]
          : []),
        prisma.plaidItem.update({
          where: { id: item.id },
          data: { syncCursor: cursor ?? null },
        }),
      ]);
      transactionsSynced += added.length;
    }

    await captureNetWorthSnapshot(userId);
    return { accountsSynced, transactionsSynced };
  });
}

const txnQuerySchema = z.object({
  accountId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const categoryPatchSchema = z.object({ category: z.string().min(1).max(64) });

export async function transactionRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = txnQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { accountId, limit, offset } = parsed.data;
    const txns = await prisma.transaction.findMany({
      where: { userId: req.user.sub, ...(accountId ? { accountId } : {}) },
      orderBy: { postedAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return {
      transactions: txns.map((t) => ({
        id: t.id,
        accountId: t.accountId,
        amountCents: Number(t.amountCents),
        description: t.description,
        merchant: t.merchant,
        category: t.category,
        postedAt: t.postedAt,
        pending: t.pending,
      })),
    };
  });

  // Category override — user-set category wins over Plaid's.
  app.patch('/:id/category', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = categoryPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { id } = req.params as { id: string };
    const txn = await prisma.transaction.findFirst({ where: { id, userId: req.user.sub } });
    if (!txn) return reply.status(404).send({ error: 'Transaction not found' });

    const updated = await prisma.transaction.update({
      where: { id },
      data: { category: parsed.data.category },
    });
    return { id: updated.id, category: updated.category };
  });
}

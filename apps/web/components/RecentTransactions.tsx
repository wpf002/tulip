'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, formatUSDExact } from '../lib/api';
import { PencilIcon } from './Icons';

interface TxnDto {
  id: string;
  accountId: string;
  amountCents: number;
  description: string;
  merchant: string | null;
  category: string | null;
  postedAt: string;
  pending: boolean;
}

/** Recent transactions with inline category override (user-set beats Plaid's). */
export function RecentTransactions() {
  const [txns, setTxns] = useState<TxnDto[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    const res = await api<{ transactions: TxnDto[] }>('/transactions?limit=15');
    setTxns(res.transactions);
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  async function saveCategory(id: string) {
    const category = draft.trim();
    setEditing(null);
    if (!category) return;
    await api(`/transactions/${id}/category`, { method: 'PATCH', body: JSON.stringify({ category }) });
    load();
  }

  if (!txns) return null;

  return (
    <section style={{ margin: '2rem 0' }}>
      <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Recent transactions</h2>
      {txns.length === 0 && (
        <p style={{ color: 'var(--slate)' }}>
          No transactions yet — they&apos;ll appear here after your first account sync.
        </p>
      )}
      {txns.map((t) => (
        <div
          key={t.id}
          className="card"
          style={{ alignItems: 'center', display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', padding: '0.75rem 1rem', flexWrap: 'wrap' }}
        >
          <span style={{ color: 'var(--slate)', fontSize: '0.8rem', width: 78 }} className="numeric">
            {t.postedAt.slice(0, 10)}
          </span>
          <span style={{ flex: 1, minWidth: 160 }}>
            {t.description}
            {t.pending && <span style={{ color: 'var(--slate)', fontSize: '0.75rem' }}> · pending</span>}
          </span>
          {editing === t.id ? (
            <input
              className="field"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', width: 130 }}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => saveCategory(t.id)}
              onKeyDown={(e) => e.key === 'Enter' && saveCategory(t.id)}
            />
          ) : (
            <button
              className="chip"
              title="Click to recategorize"
              onClick={() => {
                setEditing(t.id);
                setDraft(t.category ?? '');
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              {t.category ?? 'Uncategorized'} <PencilIcon size={11} />
            </button>
          )}
          <span
            className="numeric"
            style={{ color: t.amountCents < 0 ? 'var(--offwhite)' : 'var(--tulip-property)', textAlign: 'right', width: 100 }}
          >
            {t.amountCents < 0 ? '−' : '+'}
            {formatUSDExact(Math.abs(t.amountCents))}
          </span>
        </div>
      ))}
    </section>
  );
}

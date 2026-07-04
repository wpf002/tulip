'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getToken, formatUSDExact } from '../../lib/api';

interface BudgetDto {
  id: string;
  category: string;
  monthlyLimitCents: number;
  spentCents: number;
  remainingCents: number;
  overCents: number;
}

interface SuggestDto {
  surplusCents: number;
  perCategory: { category: string; surplusCents: number }[];
  destination: { kind: string; label: string; targetId: string | null; rationale: string } | null;
  debtFreeDelta: {
    baselineDebtFreeDate: string;
    sweptDebtFreeDate: string;
    monthsSooner: number;
    interestSavedCents: number;
  } | null;
}

export default function BudgetPage() {
  const router = useRouter();
  const [budgets, setBudgets] = useState<BudgetDto[] | null>(null);
  const [suggest, setSuggest] = useState<SuggestDto | null>(null);
  const [form, setForm] = useState({ category: '', limit: '' });
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [b, s] = await Promise.all([
      api<{ budgets: BudgetDto[] }>('/budgets'),
      api<SuggestDto>('/reallocate/suggest'),
    ]);
    setBudgets(b.budgets);
    setSuggest(s);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    load().catch(() => undefined);
  }, [load, router]);

  async function addBudget() {
    await api('/budgets', {
      method: 'POST',
      body: JSON.stringify({ category: form.category, monthlyLimitCents: Math.round(Number(form.limit) * 100) }),
    });
    setForm({ category: '', limit: '' });
    load();
  }

  async function acceptSweep() {
    if (!suggest?.destination?.targetId) return;
    const res = await api<{ applied: number }>('/reallocate/apply', {
      method: 'POST',
      body: JSON.stringify({ amountCents: suggest.surplusCents, debtId: suggest.destination.targetId }),
    });
    setNotice(`Swept ${formatUSDExact(res.applied)} → ${suggest.destination.label}.`);
    load();
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ fontSize: '1.25rem', margin: 0 }}>🌷 Budget</h1>
        <Link href="/dashboard" className="btn-link">
          ← Dashboard
        </Link>
      </header>

      {/* The one-tap sweep card */}
      {suggest && suggest.surplusCents > 0 && suggest.destination && (
        <section
          className="card"
          style={{ margin: '1.5rem 0', borderColor: 'var(--tulip-property)', borderWidth: 1, borderStyle: 'solid' }}
        >
          <p style={{ margin: 0 }}>
            You&apos;re <strong>{formatUSDExact(suggest.surplusCents)}</strong> under budget this month.
            Sweep it to <strong>{suggest.destination.label}</strong>
            {suggest.debtFreeDelta && suggest.debtFreeDelta.monthsSooner > 0 && (
              <>
                {' '}
                — your debt-free date moves up{' '}
                <strong style={{ color: 'var(--tulip-property)' }}>
                  {suggest.debtFreeDelta.monthsSooner} months
                </strong>{' '}
                and saves {formatUSDExact(suggest.debtFreeDelta.interestSavedCents)} in interest
              </>
            )}
            ?
          </p>
          <button className="btn-primary" style={{ marginTop: '0.75rem' }} onClick={acceptSweep}>
            Sweep {formatUSDExact(suggest.surplusCents)}
          </button>
        </section>
      )}
      {notice && <p style={{ color: 'var(--tulip-property)' }}>{notice}</p>}

      <section style={{ margin: '1.5rem 0' }}>
        <h2 style={{ fontSize: '1rem' }}>This month</h2>
        {(budgets ?? []).map((b) => {
          const pct = Math.min(1, b.spentCents / b.monthlyLimitCents);
          const over = b.overCents > 0;
          return (
            <div key={b.id} className="card" style={{ marginBottom: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span>{b.category}</span>
                <span style={{ color: over ? 'var(--tulip-debt)' : 'var(--slate)' }}>
                  {formatUSDExact(b.spentCents)} / {formatUSDExact(b.monthlyLimitCents)}
                  {over && <> · {formatUSDExact(b.overCents)} over</>}
                </span>
              </div>
              <div style={{ background: 'var(--ink)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                <div
                  style={{
                    background: over ? 'var(--tulip-debt)' : 'var(--tulip-property)',
                    height: '100%',
                    width: `${pct * 100}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
        {budgets?.length === 0 && <p style={{ color: 'var(--slate)' }}>No budgets yet — add a category below.</p>}
      </section>

      <section className="card">
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Add / update a category</h2>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <input className="field" style={{ flex: 2 }} placeholder="Category (e.g. Groceries)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input className="field" style={{ flex: 1 }} placeholder="Limit $/mo" inputMode="decimal" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} />
          <button className="btn-primary" onClick={addBudget} disabled={!form.category || !Number(form.limit)}>
            Save
          </button>
        </div>
      </section>
    </main>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken, formatUSD, formatUSDExact } from '../../lib/api';
import { AppNav } from '../../components/AppNav';

interface PropertyDto {
  id: string;
  label: string;
  estimatedValueCents: number;
  mortgageBalanceCents: number;
  equityCents: number;
  isRental: boolean;
  monthlyRentCents: number | null;
}

interface DealDto {
  loanAmountCents: number;
  monthlyDebtServiceCents: number;
  monthlyNOICents: number;
  capRate: number;
  cashOnCash: number;
  dscr: number | null;
  monthlyCashflowCents: number;
}

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

export default function PropertyPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<PropertyDto[] | null>(null);
  const [deal, setDeal] = useState<DealDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    price: '200000',
    down: '50000',
    apr: '6.0',
    term: '360',
    rent: '2000',
    expenses: '800',
  });

  const load = useCallback(async () => {
    const res = await api<{ properties: PropertyDto[] }>('/property');
    setProperties(res.properties);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    load().catch(() => undefined);
  }, [load, router]);

  async function analyze() {
    setError(null);
    try {
      const res = await api<DealDto>('/property/analyze', {
        method: 'POST',
        body: JSON.stringify({
          purchasePriceCents: Math.round(Number(form.price) * 100),
          downPaymentCents: Math.round(Number(form.down) * 100),
          aprBps: Math.round(Number(form.apr) * 100),
          termMonths: Number(form.term),
          monthlyRentCents: Math.round(Number(form.rent) * 100),
          monthlyExpensesCents: Math.round(Number(form.expenses) * 100),
        }),
      });
      setDeal(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    }
  }

  const field = (key: keyof typeof form, label: string) => (
    <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--slate)' }}>
      {label}
      <input className="field" inputMode="decimal" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </label>
  );

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
      <AppNav />
      <h1 className="display" style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>
        Property
      </h1>

      <section className="card" style={{ margin: '1.5rem 0' }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Rental deal analyzer</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
          {field('price', 'Purchase price $')}
          {field('down', 'Down payment $')}
          {field('apr', 'APR %')}
          {field('term', 'Term (months)')}
          {field('rent', 'Monthly rent $')}
          {field('expenses', 'Monthly expenses $')}
        </div>
        <button className="btn-primary" style={{ marginTop: '0.75rem' }} onClick={analyze}>
          Analyze deal
        </button>
        {error && <p style={{ color: 'var(--tulip-debt)' }}>{error}</p>}

        {deal && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginTop: '1rem', textAlign: 'center' }}>
            <Metric label="Cap rate" value={pct(deal.capRate)} good={deal.capRate >= 0.05} />
            <Metric label="Cash-on-cash" value={pct(deal.cashOnCash)} good={deal.cashOnCash >= 0.06} />
            <Metric label="DSCR" value={deal.dscr === null ? '∞' : deal.dscr.toFixed(2)} good={(deal.dscr ?? 99) >= 1.2} />
            <Metric
              label="Cashflow/mo"
              value={formatUSDExact(deal.monthlyCashflowCents)}
              good={deal.monthlyCashflowCents > 0}
            />
            <p style={{ gridColumn: '1 / -1', margin: 0, color: 'var(--slate)', fontSize: '0.85rem' }}>
              Loan {formatUSD(deal.loanAmountCents)} · debt service {formatUSDExact(deal.monthlyDebtServiceCents)}/mo ·
              NOI {formatUSDExact(deal.monthlyNOICents)}/mo
            </p>
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: '1rem' }}>Owned properties</h2>
        {(properties ?? []).map((p) => (
          <div key={p.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span>
              {p.label}
              {p.isRental && <span style={{ color: 'var(--tulip-property)', fontSize: '0.8rem' }}> · rental</span>}
            </span>
            <span>
              {formatUSD(p.equityCents)} equity{' '}
              <span style={{ color: 'var(--slate)' }}>
                ({formatUSD(p.estimatedValueCents)} − {formatUSD(p.mortgageBalanceCents)})
              </span>
            </span>
          </div>
        ))}
        {properties?.length === 0 && <p style={{ color: 'var(--slate)' }}>No properties tracked yet.</p>}
      </section>
    </main>
  );
}

function Metric({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div>
      <p style={{ margin: 0, color: 'var(--slate)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </p>
      <p style={{ margin: '0.2rem 0 0', fontSize: '1.3rem', fontWeight: 700, color: good ? 'var(--tulip-property)' : 'var(--tulip-debt)' }}>
        {value}
      </p>
    </div>
  );
}

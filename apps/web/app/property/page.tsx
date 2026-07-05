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

interface ImpactDto {
  cashRequiredCents: number;
  cashAfterCents: number;
  affordable: boolean;
  netWorthDeltaCents: number;
  monthlyCashflowCents: number;
  surplusAfterCents: number;
  goalShifts: {
    goalId: string;
    name: string;
    dateBefore: string | null;
    dateAfter: string | null;
    monthsDelta: number | null;
  }[];
}

interface SellVsHoldDto {
  equityCents: number;
  sell: { netProceedsCents: number; projectedValueCents: number };
  hold: { projectedEquityCents: number; cumulativeCashflowCents: number; projectedValueCents: number };
  refi: { cashOutCents: number; newPaymentCents: number; monthlyCashflowAfterCents: number; projectedValueCents: number } | null;
  bestOption: 'sell' | 'hold' | 'refi';
}

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

function formatMonthYear(iso: string | null): string {
  if (!iso) return 'stalled at this rate';
  const [y, m] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function PropertyPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<PropertyDto[] | null>(null);
  const [deal, setDeal] = useState<DealDto | null>(null);
  const [impact, setImpact] = useState<ImpactDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    price: '200000',
    down: '50000',
    closing: '5000',
    apr: '6.0',
    term: '360',
    rent: '2000',
    expenses: '800',
    surplus: '1000',
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
    const body = {
      purchasePriceCents: Math.round(Number(form.price) * 100),
      downPaymentCents: Math.round(Number(form.down) * 100),
      closingCostsCents: Math.round(Number(form.closing) * 100),
      aprBps: Math.round(Number(form.apr) * 100),
      termMonths: Number(form.term),
      monthlyRentCents: Math.round(Number(form.rent) * 100),
      monthlyExpensesCents: Math.round(Number(form.expenses) * 100),
    };
    try {
      const [d, i] = await Promise.all([
        api<DealDto>('/property/analyze', { method: 'POST', body: JSON.stringify(body) }),
        api<ImpactDto>('/property/purchase-impact', {
          method: 'POST',
          body: JSON.stringify({ ...body, monthlySurplusCents: Math.round(Number(form.surplus) * 100) }),
        }),
      ]);
      setDeal(d);
      setImpact(i);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    }
  }

  const field = (key: keyof typeof form, label: string, opts: { money?: boolean } = {}) => (
    <label className="deal-field">
      <span>{label}</span>
      {opts.money ? (
        <div className="money-input">
          <span className="adorn">$</span>
          <input className="field" inputMode="decimal" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
        </div>
      ) : (
        <input className="field" inputMode="decimal" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      )}
    </label>
  );

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
      <AppNav />
      <h1 className="display" style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>
        Property
      </h1>

      <section className="card" style={{ margin: '1.5rem 0' }}>
        <h2 style={{ fontSize: '1.05rem', marginTop: 0, marginBottom: '0.25rem' }}>Rental deal analyzer</h2>
        <p style={{ color: 'var(--slate)', fontSize: '0.88rem', margin: '0 0 1.35rem' }}>
          Enter a rental you&apos;re weighing and see whether the numbers work.
        </p>
        <div className="deal-grid">
          {field('price', 'Purchase price', { money: true })}
          {field('down', 'Down payment', { money: true })}
          {field('closing', 'Closing costs', { money: true })}
          {field('apr', 'Mortgage rate %')}
          {field('term', 'Loan term (months)')}
          {field('rent', 'Monthly rent', { money: true })}
          {field('expenses', 'Monthly expenses', { money: true })}
          {field('surplus', 'Monthly surplus', { money: true })}
        </div>
        <button className="btn-primary" style={{ marginTop: '1.35rem' }} onClick={analyze}>
          Analyze deal
        </button>
        {error && <p style={{ color: 'var(--tulip-debt)' }}>{error}</p>}

        {deal && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
              <Metric label="Cap rate" value={pct(deal.capRate)} good={deal.capRate >= 0.05} />
              <Metric label="Cash-on-cash" value={pct(deal.cashOnCash)} good={deal.cashOnCash >= 0.06} />
              <Metric label="Covers mortgage" value={deal.dscr === null ? 'Yes' : `${deal.dscr.toFixed(2)}×`} good={(deal.dscr ?? 99) >= 1.2} />
              <Metric label="Cashflow / mo" value={formatUSDExact(deal.monthlyCashflowCents)} good={deal.monthlyCashflowCents > 0} />
            </div>
            <p style={{ margin: '0.9rem 0 0', color: 'var(--slate)', fontSize: '0.85rem' }}>
              {formatUSD(deal.loanAmountCents)} loan · {formatUSDExact(deal.monthlyDebtServiceCents)}/mo mortgage ·
              {' '}{formatUSDExact(deal.monthlyNOICents)}/mo after expenses
            </p>
          </div>
        )}
      </section>

      {/* If you buy this: net-worth + goal-date impact */}
      {impact && (
        <section
          className="card"
          style={{ marginBottom: '1.5rem', borderColor: impact.affordable ? 'var(--tulip-property)' : 'var(--tulip-debt)', borderStyle: 'solid', borderWidth: 1 }}
        >
          <h2 style={{ fontSize: '1rem', marginTop: 0 }}>If you buy this</h2>
          {!impact.affordable && (
            <p style={{ color: 'var(--tulip-debt)', margin: '0 0 0.75rem' }}>
              You&apos;re {formatUSDExact(-impact.cashAfterCents)} short — this deal needs{' '}
              {formatUSDExact(impact.cashRequiredCents)} in cash.
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: impact.goalShifts.length ? '1rem' : 0 }}>
            <Metric label="Cash needed" value={formatUSD(impact.cashRequiredCents)} good={impact.affordable} />
            <Metric label="Cash left after" value={formatUSD(impact.cashAfterCents)} good={impact.cashAfterCents >= 0} />
            <Metric label="Net worth day one" value={formatUSDExact(impact.netWorthDeltaCents)} good={impact.netWorthDeltaCents >= 0} />
            <Metric
              label="Monthly surplus"
              value={`${formatUSDExact(impact.surplusAfterCents)}`}
              good={impact.surplusAfterCents >= 0}
            />
          </div>
          {impact.goalShifts.length > 0 && (
            <div>
              <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>
                Your other goals move
              </p>
              {impact.goalShifts.map((s) => (
                <div key={s.goalId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.35rem 0', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span>{s.name}</span>
                  <span style={{ color: 'var(--slate)', fontSize: '0.9rem' }}>
                    {formatMonthYear(s.dateBefore)} → <strong style={{ color: 'var(--offwhite)' }}>{formatMonthYear(s.dateAfter)}</strong>
                    {s.monthsDelta !== null && s.monthsDelta !== 0 && (
                      <strong style={{ color: s.monthsDelta < 0 ? 'var(--tulip-property)' : 'var(--tulip-debt)', marginLeft: '0.5rem' }}>
                        {s.monthsDelta < 0 ? `${-s.monthsDelta} mo sooner` : `${s.monthsDelta} mo later`}
                      </strong>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 style={{ fontSize: '1rem' }}>Owned properties</h2>
        {(properties ?? []).map((p) => (
          <OwnedProperty key={p.id} property={p} />
        ))}
        {properties?.length === 0 && <p style={{ color: 'var(--slate)' }}>No properties tracked yet.</p>}
      </section>
    </main>
  );
}

function OwnedProperty({ property }: { property: PropertyDto }) {
  const [analysis, setAnalysis] = useState<SellVsHoldDto | null>(null);
  const [busy, setBusy] = useState(false);

  async function analyze() {
    setBusy(true);
    try {
      const res = await api<SellVsHoldDto>('/property/sell-vs-hold', {
        method: 'POST',
        body: JSON.stringify({
          propertyId: property.id,
          horizonMonths: 60,
          cashOutRefi: { ltv: 0.75, newAprBps: 550, newTermMonths: 360, closingCostsCents: 500000 },
        }),
      });
      setAnalysis(res);
    } finally {
      setBusy(false);
    }
  }

  const OPTION_LABELS = { sell: 'Sell now', hold: 'Keep holding', refi: 'Cash-out refi' } as const;

  return (
    <div className="card" style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span>
          {property.label}
          {property.isRental && <span style={{ color: 'var(--tulip-property)', fontSize: '0.8rem' }}> · Rental</span>}
        </span>
        <span style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span>
            {formatUSD(property.equityCents)} equity{' '}
            <span style={{ color: 'var(--slate)' }}>
              ({formatUSD(property.estimatedValueCents)} − {formatUSD(property.mortgageBalanceCents)})
            </span>
          </span>
          <button className="btn-secondary" onClick={analyze} disabled={busy}>
            {busy ? '…' : analysis ? 'Refresh' : 'Sell vs hold'}
          </button>
        </span>
      </div>

      {analysis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
          {(['sell', 'hold', 'refi'] as const).map((key) => {
            const best = analysis.bestOption === key;
            const value =
              key === 'sell' ? analysis.sell.projectedValueCents : key === 'hold' ? analysis.hold.projectedValueCents : analysis.refi?.projectedValueCents;
            if (value === undefined || value === null) return null;
            return (
              <div
                key={key}
                style={{
                  border: `1px solid ${best ? 'var(--tulip-property)' : 'var(--hairline-strong)'}`,
                  borderRadius: 10,
                  padding: '0.8rem',
                }}
              >
                <p className="eyebrow" style={{ margin: '0 0 0.2rem' }}>
                  {OPTION_LABELS[key]} {best && <span style={{ color: 'var(--tulip-property)' }}>· best</span>}
                </p>
                <p className="numeric" style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                  {formatUSD(value)}
                </p>
                <p style={{ color: 'var(--slate)', fontSize: '0.78rem', margin: '0.25rem 0 0' }}>
                  {key === 'sell' && `proceeds ${formatUSD(analysis.sell.netProceedsCents)} reinvested, 5y`}
                  {key === 'hold' && `equity + ${formatUSD(analysis.hold.cumulativeCashflowCents)} cashflow, 5y`}
                  {key === 'refi' && analysis.refi && `${formatUSD(analysis.refi.cashOutCents)} cash out, 5y`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="stat-tile">
      <p style={{ margin: 0, color: 'var(--slate)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </p>
      <p className="numeric" style={{ margin: '0.3rem 0 0', fontSize: '1.3rem', fontWeight: 700, color: good ? 'var(--tulip-property)' : 'var(--tulip-debt)' }}>
        {value}
      </p>
    </div>
  );
}

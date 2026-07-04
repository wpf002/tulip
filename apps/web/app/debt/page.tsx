'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken, formatUSD, formatUSDExact } from '../../lib/api';
import { AppNav } from '../../components/AppNav';

interface DebtDto {
  id: string;
  name: string;
  type: 'STUDENT_LOAN' | 'MORTGAGE' | 'AUTO' | 'CREDIT_CARD' | 'PERSONAL' | 'OTHER';
  balanceCents: number;
  aprBps: number;
  minPaymentCents: number;
  isFederal: boolean;
  pslfPaymentsMade: number | null;
}

interface PlanDto {
  strategy: string;
  monthsToDebtFree: number;
  debtFreeDate: string;
  totalInterestCents: number;
  payoffOrder: { loanId: string; name: string; payoffMonth: number; interestPaidCents: number }[];
  monthlySchedule: { month: number; remainingBalanceCents: number }[];
}

interface CompareDto {
  avalanche: { debtFreeDate: string; months: number; totalInterestCents: number };
  snowball: { debtFreeDate: string; months: number; totalInterestCents: number };
  snowballCostsExtraInterestCents: number;
  snowballCostsExtraMonths: number;
}

const TYPE_OPTIONS = ['CREDIT_CARD', 'STUDENT_LOAN', 'AUTO', 'MORTGAGE', 'PERSONAL', 'OTHER'] as const;

function formatMonthYear(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function DebtPage() {
  const router = useRouter();
  const [debts, setDebts] = useState<DebtDto[] | null>(null);
  const [plan, setPlan] = useState<PlanDto | null>(null);
  const [compare, setCompare] = useState<CompareDto | null>(null);
  const [extraDollars, setExtraDollars] = useState(200);
  const [strategy, setStrategy] = useState<'avalanche' | 'snowball'>('avalanche');
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadDebts = useCallback(async () => {
    const res = await api<{ debts: DebtDto[] }>('/debt');
    setDebts(res.debts);
  }, []);

  const loadPlan = useCallback(async (extra: number, strat: string) => {
    try {
      const extraCents = Math.round(extra * 100);
      const [p, c] = await Promise.all([
        api<PlanDto>(`/debt/plan?extraCents=${extraCents}&strategy=${strat}`),
        api<CompareDto>(`/debt/compare?extraCents=${extraCents}`),
      ]);
      setPlan(p);
      setCompare(c);
      setError(null);
    } catch (err) {
      setPlan(null);
      setCompare(null);
      setError(err instanceof Error ? err.message : 'Failed to compute plan');
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    loadDebts().catch(() => setError('Failed to load debts'));
  }, [loadDebts, router]);

  // Recompute live as the slider moves, debounced to keep the API happy.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadPlan(extraDollars, strategy), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [extraDollars, strategy, loadPlan]);

  const nonMortgage = useMemo(() => (debts ?? []).filter((d) => d.balanceCents > 0), [debts]);

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
      <AppNav />

      {/* HERO: the Debt-Free Date */}
      <section style={{ margin: '2.5rem 0', textAlign: 'center' }}>
        <p className="eyebrow">Debt-free date</p>
        <p className="display" style={{ fontSize: '3.2rem', margin: '0.25rem 0', color: 'var(--tulip-debt)' }}>
          {plan ? formatMonthYear(plan.debtFreeDate) : error ? '—' : '…'}
        </p>
        {plan && (
          <p style={{ color: 'var(--slate)', margin: 0 }}>
            {plan.monthsToDebtFree} months · {formatUSD(plan.totalInterestCents)} total interest ({strategy})
          </p>
        )}
        {error && <p style={{ color: 'var(--slate)' }}>{error}</p>}
      </section>

      {/* Live extra-payment slider */}
      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <label htmlFor="extra" style={{ color: 'var(--slate)' }}>
            Extra toward debt each month
          </label>
          <strong>${extraDollars}</strong>
        </div>
        <input
          id="extra"
          type="range"
          min={0}
          max={2000}
          step={25}
          value={extraDollars}
          onChange={(e) => setExtraDollars(Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--tulip-debt)' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          {(['avalanche', 'snowball'] as const).map((s) => (
            <button key={s} className={strategy === s ? 'chip chip-active' : 'chip'} onClick={() => setStrategy(s)}>
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* Avalanche vs snowball, side by side, with the honest cost */}
      {compare && (
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {(['avalanche', 'snowball'] as const).map((s) => (
            <div key={s} className="card" style={{ borderColor: strategy === s ? 'var(--tulip-debt)' : undefined }}>
              <p style={{ margin: 0, color: 'var(--slate)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.08em' }}>
                {s === 'avalanche' ? 'Avalanche (highest APR first)' : 'Snowball (smallest balance first)'}
              </p>
              <p style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0.35rem 0' }}>
                {formatMonthYear(compare[s].debtFreeDate)}
              </p>
              <p style={{ margin: 0, color: 'var(--slate)' }}>
                {compare[s].months} mo · {formatUSDExact(compare[s].totalInterestCents)} interest
              </p>
            </div>
          ))}
          <p style={{ gridColumn: '1 / -1', margin: 0, color: 'var(--slate)', fontSize: '0.9rem' }}>
            {compare.snowballCostsExtraInterestCents > 0 ? (
              <>
                Choosing snowball costs{' '}
                <strong style={{ color: 'var(--tulip-debt)' }}>
                  {formatUSDExact(compare.snowballCostsExtraInterestCents)}
                </strong>{' '}
                more interest
                {compare.snowballCostsExtraMonths > 0 && <> and {compare.snowballCostsExtraMonths} extra months</>}.
              </>
            ) : (
              'For your debts, snowball and avalanche cost the same — pick either.'
            )}
          </p>
        </section>
      )}

      {/* Payoff order timeline */}
      {plan && plan.payoffOrder.length > 0 && (
        <section className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Payoff order</h2>
          {plan.payoffOrder.map((p, i) => (
            <div key={p.loanId} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0' }}>
              <span
                style={{
                  background: 'var(--tulip-debt)',
                  borderRadius: '50%',
                  width: 22,
                  height: 22,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {i + 1}
              </span>
              <span style={{ flex: 1 }}>{p.name}</span>
              <span style={{ color: 'var(--slate)', fontSize: '0.9rem' }}>
                month {p.payoffMonth} · {formatUSDExact(p.interestPaidCents)} interest
              </span>
            </div>
          ))}
        </section>
      )}

      <DebtList debts={debts} onChanged={() => Promise.all([loadDebts(), loadPlan(extraDollars, strategy)])} />
      {nonMortgage.some((d) => d.type === 'STUDENT_LOAN') && (
        <StudentLoanPanel debts={nonMortgage.filter((d) => d.type === 'STUDENT_LOAN')} />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------

function DebtList({ debts, onChanged }: { debts: DebtDto[] | null; onChanged: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'CREDIT_CARD' as string, balance: '', apr: '', minPayment: '' });
  const [error, setError] = useState<string | null>(null);

  async function addDebt() {
    setError(null);
    try {
      await api('/debt', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          balanceCents: Math.round(Number(form.balance) * 100),
          aprBps: Math.round(Number(form.apr) * 100), // "7.8" (%) -> 780 bps
          minPaymentCents: Math.round(Number(form.minPayment) * 100),
          isFederal: form.type === 'STUDENT_LOAN',
        }),
      });
      setShowForm(false);
      setForm({ name: '', type: 'CREDIT_CARD', balance: '', apr: '', minPayment: '' });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add debt');
    }
  }

  async function removeDebt(id: string) {
    await api(`/debt/${id}`, { method: 'DELETE' });
    onChanged();
  }

  return (
    <section style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1rem', margin: 0 }}>Your debts</h2>
        <button className="btn-secondary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add debt'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '0.75rem', display: 'grid', gap: '0.6rem' }}>
          <input className="field" placeholder="Name (e.g. Chase Sapphire)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t.replace('_', ' ')}
              </option>
            ))}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
            <input className="field" placeholder="Balance $" inputMode="decimal" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} />
            <input className="field" placeholder="APR %" inputMode="decimal" value={form.apr} onChange={(e) => setForm({ ...form, apr: e.target.value })} />
            <input className="field" placeholder="Min pay $" inputMode="decimal" value={form.minPayment} onChange={(e) => setForm({ ...form, minPayment: e.target.value })} />
          </div>
          {error && <p style={{ color: 'var(--tulip-debt)', margin: 0 }}>{error}</p>}
          <button className="btn-primary" onClick={addDebt} disabled={!form.name || !form.balance || !form.apr}>
            Save debt
          </button>
        </div>
      )}

      {(debts ?? []).map((d) => (
        <div key={d.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0 }}>
              {d.name}
              {d.isFederal && <span style={{ color: 'var(--tulip-retire)', fontSize: '0.8rem' }}> · federal</span>}
            </p>
            <p style={{ margin: 0, color: 'var(--slate)', fontSize: '0.85rem' }}>
              {(d.aprBps / 100).toFixed(2)}% APR · min {formatUSDExact(d.minPaymentCents)}/mo
            </p>
          </div>
          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatUSDExact(d.balanceCents)}</strong>
          <button className="btn-link" onClick={() => removeDebt(d.id)} aria-label={`Delete ${d.name}`}>
            ✕
          </button>
        </div>
      ))}
      {debts?.length === 0 && <p style={{ color: 'var(--slate)' }}>No debts — add one to see your debt-free date.</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------

interface AnalysisDto {
  standardTenYearPaymentCents: number;
  idr: { selectedPlan: string; paymentCents: number; byPlan: Record<string, number> } | null;
  pslf: { paymentsMade: number; paymentsRemaining: number; forgivenessDate: string; projectedForgivenCents: number } | null;
  forgivenessTaxBomb: { forgivenessDate: string; projectedForgivenCents: number; taxBombCents: number } | null;
  refi: { refiForfeitsFederalBenefits: boolean; lostBenefits: string[]; newPaymentCents: number; monthlySavingsCents: number; breakEvenMonths: number | null } | null;
}

function StudentLoanPanel({ debts }: { debts: DebtDto[] }) {
  const [debtId, setDebtId] = useState(debts[0]!.id);
  const [agi, setAgi] = useState('60000');
  const [familySize, setFamilySize] = useState('1');
  const [analysis, setAnalysis] = useState<AnalysisDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setError(null);
    try {
      const res = await api<AnalysisDto>(`/debt/${debtId}/student-loan/analyze`, {
        method: 'POST',
        body: JSON.stringify({
          agiCents: Math.round(Number(agi) * 100),
          familySize: Number(familySize),
          refi: { newAprBps: 500, newTermMonths: 120, feesCents: 0 },
        }),
      });
      setAnalysis(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    }
  }

  return (
    <section className="card" style={{ marginBottom: '1.5rem' }}>
      <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Student loan lab</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.6rem', alignItems: 'center' }}>
        <select className="field" value={debtId} onChange={(e) => setDebtId(e.target.value)}>
          {debts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <input className="field" placeholder="AGI $" inputMode="numeric" value={agi} onChange={(e) => setAgi(e.target.value)} />
        <input className="field" placeholder="Family" inputMode="numeric" value={familySize} onChange={(e) => setFamilySize(e.target.value)} />
        <button className="btn-primary" onClick={analyze}>
          Analyze
        </button>
      </div>
      {error && <p style={{ color: 'var(--tulip-debt)' }}>{error}</p>}

      {analysis && (
        <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
          {analysis.idr && (
            <div>
              <p style={{ margin: '0 0 0.25rem', color: 'var(--slate)', fontSize: '0.85rem' }}>
                Income-driven payment (vs standard {formatUSDExact(analysis.standardTenYearPaymentCents)}/mo)
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {Object.entries(analysis.idr.byPlan).map(([plan, cents]) => (
                  <span key={plan}>
                    <strong>{plan}</strong> {formatUSDExact(cents)}/mo
                  </span>
                ))}
              </div>
            </div>
          )}
          {analysis.pslf && (
            <p style={{ margin: 0 }}>
              <strong>PSLF:</strong> {analysis.pslf.paymentsMade}/120 payments · forgiveness{' '}
              {analysis.pslf.forgivenessDate} · projected{' '}
              <strong style={{ color: 'var(--tulip-property)' }}>
                {formatUSD(analysis.pslf.projectedForgivenCents)}
              </strong>{' '}
              forgiven (tax-free)
            </p>
          )}
          {analysis.forgivenessTaxBomb && (
            <p style={{ margin: 0 }}>
              <strong>IDR forgiveness tax bomb:</strong> ~{formatUSD(analysis.forgivenessTaxBomb.projectedForgivenCents)}{' '}
              forgiven on {analysis.forgivenessTaxBomb.forgivenessDate} could add{' '}
              <strong style={{ color: 'var(--tulip-debt)' }}>{formatUSD(analysis.forgivenessTaxBomb.taxBombCents)}</strong>{' '}
              of taxable income under current law.
            </p>
          )}
          {analysis.refi && analysis.refi.refiForfeitsFederalBenefits && (
            <div style={{ border: '1px solid var(--tulip-debt)', borderRadius: 8, padding: '0.75rem' }}>
              <p style={{ margin: '0 0 0.35rem', color: 'var(--tulip-debt)', fontWeight: 700 }}>
                ⚠ Refinancing this federal loan forfeits:
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--slate)' }}>
                {analysis.refi.lostBenefits.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <p style={{ margin: '0.5rem 0 0', color: 'var(--slate)', fontSize: '0.9rem' }}>
                A 5%/10y refi would pay {formatUSDExact(analysis.refi.newPaymentCents)}/mo
                {analysis.refi.breakEvenMonths !== null && <> · break-even {analysis.refi.breakEvenMonths} mo</>}
                — weigh it against everything above first.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

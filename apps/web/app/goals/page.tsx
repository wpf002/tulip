'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken, formatUSD, formatUSDExact } from '../../lib/api';
import { AppNav } from '../../components/AppNav';

interface GoalDto {
  id: string;
  name: string;
  type: string;
  targetCents: number;
  savedCents: number;
  targetDate: string;
  priority: number;
  colorTag: string;
}

interface RoutedDto {
  kind: string;
  label: string;
  effectiveReturn: number;
  amountCents: number;
  projectedAnnualValueCents: number;
  rationale: string;
}

interface ScenarioDto {
  label: string;
  perGoalMonthly: Record<string, number>;
  projectedDates: Record<string, string | null>;
  monthsToComplete: Record<string, number | null>;
}

const COLOR_VARS: Record<string, string> = {
  red: 'var(--tulip-debt)',
  green: 'var(--tulip-property)',
  purple: 'var(--tulip-retire)',
  white: 'var(--tulip-emergency)',
};

function formatMonthYear(iso: string | null): string {
  if (!iso) return 'never at this rate';
  const [y, m] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function GoalsPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<GoalDto[] | null>(null);

  const load = useCallback(async () => {
    const res = await api<{ goals: GoalDto[] }>('/goals');
    setGoals(res.goals);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    load().catch(() => undefined);
  }, [load, router]);

  const open = (goals ?? []).filter((g) => g.targetCents > g.savedCents);

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
      <AppNav />
      <h1 className="display" style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>
        Goals
      </h1>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', margin: '1.5rem 0' }}>
        {(goals ?? []).map((g) => {
          const pct = Math.min(1, g.savedCents / g.targetCents);
          const color = COLOR_VARS[g.colorTag] ?? 'var(--tulip-property)';
          return (
            <div key={g.id} className="card" style={{ borderTop: `3px solid ${color}` }}>
              <p style={{ margin: 0, fontWeight: 600 }}>{g.name}</p>
              <p style={{ margin: '0.25rem 0', color: 'var(--slate)', fontSize: '0.85rem' }}>
                {formatUSD(g.savedCents)} of {formatUSD(g.targetCents)} · by {g.targetDate}
              </p>
              <div style={{ background: 'var(--ink)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                <div style={{ background: color, height: '100%', width: `${pct * 100}%` }} />
              </div>
            </div>
          );
        })}
        {goals?.length === 0 && <p style={{ color: 'var(--slate)', gridColumn: '1 / -1' }}>No goals yet.</p>}
      </section>

      <NextDollarPanel />
      {open.length === 2 && <ConflictSlider goals={open} />}
    </main>
  );
}

// ---------------------------------------------------------------------------

function NextDollarPanel() {
  const [amount, setAmount] = useState('500');
  const [routed, setRouted] = useState<RoutedDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function route() {
    setError(null);
    try {
      const res = await api<{ routed: RoutedDto[] }>('/router/next-dollar', {
        method: 'POST',
        body: JSON.stringify({
          amountCents: Math.round(Number(amount) * 100),
          employerMatch: { matchRate: 0.5, remainingMatchableContributionCents: 20000 },
          emergencyFund: { floorCents: 1500000, savingsApr: 0.04 },
        }),
      });
      setRouted(res.routed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Routing failed');
    }
  }

  return (
    <section className="card" style={{ marginBottom: '1.5rem' }}>
      <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Where should the next dollar go?</h2>
      <div style={{ display: 'flex', gap: '0.6rem' }}>
        <input className="field" style={{ flex: 1 }} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount $" />
        <button className="btn-primary" onClick={route} disabled={!Number(amount)}>
          Route it
        </button>
      </div>
      {error && <p style={{ color: 'var(--tulip-debt)' }}>{error}</p>}
      {routed && (
        <ol style={{ margin: '1rem 0 0', paddingLeft: '1.3rem', display: 'grid', gap: '0.5rem' }}>
          {routed.map((r, i) => (
            <li key={i}>
              <strong>{formatUSDExact(r.amountCents)}</strong> → {r.label}
              <span style={{ color: 'var(--slate)', display: 'block', fontSize: '0.85rem' }}>
                {r.rationale} · ~{formatUSDExact(r.projectedAnnualValueCents)}/yr
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function ConflictSlider({ goals }: { goals: GoalDto[] }) {
  const [surplus, setSurplus] = useState('1000');
  const [weightA, setWeightA] = useState(50); // % of surplus to goal A
  const [scenario, setScenario] = useState<ScenarioDto | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [a, b] = goals as [GoalDto, GoalDto];

  const recompute = useCallback(async (pctA: number, surplusDollars: string) => {
    const surplusCents = Math.round(Number(surplusDollars) * 100);
    if (!surplusCents) return;
    try {
      const res = await api<{ scenario: ScenarioDto }>('/goals/resolve', {
        method: 'POST',
        body: JSON.stringify({ surplusCents, weights: [pctA, 100 - pctA] }),
      });
      setScenario(res.scenario);
    } catch {
      setScenario(null);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => recompute(weightA, surplus), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [weightA, surplus, recompute]);

  return (
    <section className="card">
      <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Tradeoff: {a.name} vs {b.name}</h2>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '0.75rem' }}>
        <label style={{ color: 'var(--slate)' }}>Monthly surplus $</label>
        <input className="field" style={{ width: 120 }} inputMode="decimal" value={surplus} onChange={(e) => setSurplus(e.target.value)} />
      </div>
      <input
        type="range"
        min={5}
        max={95}
        step={5}
        value={weightA}
        onChange={(e) => setWeightA(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--tulip-property)' }}
        aria-label="Allocation between goals"
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--slate)', fontSize: '0.85rem' }}>
        <span>{weightA}% → {a.name}</span>
        <span>{100 - weightA}% → {b.name}</span>
      </div>
      {scenario && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
          {[a, b].map((g) => (
            <div key={g.id} style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, color: 'var(--slate)', fontSize: '0.85rem' }}>
                {g.name} · {formatUSDExact(scenario.perGoalMonthly[g.id] ?? 0)}/mo
              </p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '1.3rem', fontWeight: 700 }}>
                {formatMonthYear(scenario.projectedDates[g.id] ?? null)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface HealthDto {
  score: number;
  subscores: { liquidity: number; debtBurden: number; savingsRate: number; netWorthTrajectory: number };
  drivers: { emergencyFundMonths: number };
}

const LABELS: Record<keyof HealthDto['subscores'], string> = {
  liquidity: 'Liquidity',
  debtBurden: 'Debt burden',
  savingsRate: 'Savings rate',
  netWorthTrajectory: 'Trajectory',
};

function band(score: number): { label: string; color: string } {
  if (score >= 75) return { label: 'Thriving', color: 'var(--tulip-property)' };
  if (score >= 50) return { label: 'Stable', color: '#d4a72c' };
  return { label: 'Needs attention', color: 'var(--tulip-debt)' };
}

/** Credit-score-style dial with transparent per-driver breakdown. */
export function HealthDial() {
  const [health, setHealth] = useState<HealthDto | null>(null);

  useEffect(() => {
    api<HealthDto>('/health/score').then(setHealth).catch(() => undefined);
  }, []);

  if (!health) return null;
  const { label, color } = band(health.score);

  const R = 54;
  const C = Math.PI * R; // semicircle
  const filled = (health.score / 100) * C;

  return (
    <section className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 140, textAlign: 'center' }}>
          <svg viewBox="0 0 140 80" style={{ width: '100%', display: 'block' }}>
            <path d="M 16 72 A 54 54 0 0 1 124 72" fill="none" stroke="var(--ink)" strokeWidth={10} strokeLinecap="round" />
            <path
              d="M 16 72 A 54 54 0 0 1 124 72"
              fill="none"
              stroke={color}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={`${filled} ${C}`}
            />
          </svg>
          <p style={{ position: 'absolute', inset: '38px 0 0', margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>
            {health.score}
          </p>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <p style={{ margin: '0 0 0.5rem' }}>
            Financial health: <strong style={{ color }}>{label}</strong>
          </p>
          {(Object.keys(LABELS) as (keyof HealthDto['subscores'])[]).map((k) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
              <span style={{ width: 110, color: 'var(--slate)', fontSize: '0.8rem' }}>{LABELS[k]}</span>
              <div style={{ flex: 1, background: 'var(--ink)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
                <div style={{ background: band(health.subscores[k]).color, height: '100%', width: `${health.subscores[k]}%` }} />
              </div>
              <span style={{ width: 28, textAlign: 'right', fontSize: '0.8rem' }}>{health.subscores[k]}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

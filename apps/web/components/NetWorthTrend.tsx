'use client';

import { formatUSD } from '../lib/api';

interface Props {
  series: { date: string; netWorthCents: number }[];
}

/** Minimal dependency-free SVG line chart for the net-worth trend. */
export function NetWorthTrend({ series }: Props) {
  if (series.length === 0) {
    return <p style={{ color: 'var(--slate)' }}>No history yet — sync an account to start the trend.</p>;
  }

  const W = 640;
  const H = 160;
  const PAD = 8;
  const values = series.map((p) => p.netWorthCents);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;

  const x = (i: number) =>
    series.length === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (series.length - 1);
  const y = (v: number) => H - PAD - ((v - lo) * (H - 2 * PAD)) / span;

  const path = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.netWorthCents).toFixed(1)}`).join(' ');
  const last = series[series.length - 1]!;
  const first = series[0]!;
  const delta = last.netWorthCents - first.netWorthCents;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <path d={path} fill="none" stroke="var(--tulip-property)" strokeWidth={2.5} strokeLinecap="round" />
        {series.map((p, i) => (
          <circle key={p.date} cx={x(i)} cy={y(p.netWorthCents)} r={3} fill="var(--tulip-property)" />
        ))}
      </svg>
      <p style={{ color: 'var(--slate)', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>
        {first.date} → {last.date} · change {delta >= 0 ? '+' : ''}
        {formatUSD(delta)}
      </p>
    </div>
  );
}

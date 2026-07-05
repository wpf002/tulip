'use client';

import { formatUSD } from '../lib/api';

interface Props {
  series: { date: string; netWorthCents: number }[];
}

/** Net-worth trend: gradient area line, with a graceful flat/single-point state. */
export function NetWorthTrend({ series }: Props) {
  if (series.length === 0) {
    return (
      <p style={{ color: 'var(--slate)', margin: 0 }}>
        Your net-worth trend fills in here as the days go by.
      </p>
    );
  }

  const W = 640;
  const H = 200;
  const PAD_X = 6;
  const PAD_Y = 28;
  const values = series.map((p) => p.netWorthCents);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo;
  const flat = series.length === 1 || span === 0;

  const x = (i: number) =>
    series.length === 1 ? W - PAD_X : PAD_X + (i * (W - 2 * PAD_X)) / (series.length - 1);
  const y = (v: number) => (flat ? H / 2 : H - PAD_Y - ((v - lo) * (H - 2 * PAD_Y)) / span);

  const linePath = flat
    ? `M${PAD_X},${H / 2} L${W - PAD_X},${H / 2}`
    : series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.netWorthCents).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${(W - PAD_X).toFixed(1)},${H} L${PAD_X},${H} Z`;

  const first = series[0]!;
  const last = series[series.length - 1]!;
  const delta = last.netWorthCents - first.netWorthCents;
  const up = delta >= 0;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--tulip-property)" stopOpacity="0.26" />
            <stop offset="100%" stopColor="var(--tulip-property)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={PAD_X} y1={H / 2} x2={W - PAD_X} y2={H / 2} stroke="var(--hairline)" strokeWidth={1} />
        <path d={areaPath} fill="url(#nwFill)" />
        <path d={linePath} fill="none" stroke="var(--tulip-property)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={x(series.length - 1)} cy={y(last.netWorthCents)} r={4.5} fill="var(--tulip-property)" stroke="var(--navy-soft)" strokeWidth={2.5} />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--slate)', fontSize: '0.82rem', marginTop: '0.6rem' }}>
        <span className="numeric">{first.date}</span>
        {flat ? (
          <span />
        ) : (
          <span style={{ color: up ? 'var(--tulip-property)' : 'var(--tulip-debt)' }}>
            {up ? '+' : ''}
            {formatUSD(delta)} over the period
          </span>
        )}
        <span className="numeric">{last.date}</span>
      </div>
    </div>
  );
}

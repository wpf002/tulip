'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  getToken,
  formatUSD,
  formatUSDExact,
  type AccountDto,
  type NetWorthDto,
} from '../../lib/api';
import { AppNav } from '../../components/AppNav';
import { NetWorthTrend } from '../../components/NetWorthTrend';
import { PlaidLinkButton } from '../../components/PlaidLinkButton';
import { HealthDial } from '../../components/HealthDial';
import { FlintChat } from '../../components/FlintChat';
import { RecentTransactions } from '../../components/RecentTransactions';

const TYPE_LABELS: Record<AccountDto['type'], string> = {
  CHECKING: 'Checking',
  SAVINGS: 'Savings',
  CASH: 'Cash',
  INVESTMENT: 'Investments',
  RETIREMENT: 'Retirement',
  CREDIT_CARD: 'Credit Cards',
  LOAN: 'Loans',
};

const LIABILITY_TYPES: AccountDto['type'][] = ['CREDIT_CARD', 'LOAN'];
const RANGES = [30, 90, 365] as const;

export default function DashboardPage() {
  const router = useRouter();
  const [days, setDays] = useState<(typeof RANGES)[number]>(90);
  const [netWorth, setNetWorth] = useState<NetWorthDto | null>(null);
  const [accounts, setAccounts] = useState<AccountDto[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [nw, acc] = await Promise.all([
      api<NetWorthDto>(`/networth?days=${days}`),
      api<{ accounts: AccountDto[] }>('/accounts'),
    ]);
    setNetWorth(nw);
    setAccounts(acc.accounts);
  }, [days]);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    load().catch((err) => setNotice(err instanceof Error ? err.message : 'Failed to load'));
  }, [load, router]);

  async function sync() {
    setSyncing(true);
    setNotice(null);
    try {
      const res = await api<{ accountsSynced: number; transactionsSynced: number }>(
        '/accounts/sync',
        { method: 'POST' },
      );
      setNotice(`Synced ${res.accountsSynced} accounts, ${res.transactionsSynced} transactions.`);
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  const grouped = new Map<AccountDto['type'], AccountDto[]>();
  for (const a of accounts ?? []) {
    grouped.set(a.type, [...(grouped.get(a.type) ?? []), a]);
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
      <AppNav />

      <section style={{ margin: '2.5rem 0' }}>
        <p className="eyebrow">Net worth</p>
        <p className="display numeric" style={{ fontSize: '3.2rem', margin: '0.25rem 0' }}>
          {netWorth ? formatUSDExact(netWorth.netWorthCents) : '—'}
        </p>
        {netWorth && (
          <p style={{ color: 'var(--slate)', margin: 0 }}>
            {formatUSD(netWorth.assetsCents)} assets · {formatUSD(netWorth.liabilitiesCents)} owed
          </p>
        )}
      </section>

      <HealthDial />

      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', margin: 0 }}>Trend</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {RANGES.map((r) => (
              <button
                key={r}
                className={days === r ? 'chip chip-active' : 'chip'}
                onClick={() => setDays(r)}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>
        {netWorth && <NetWorthTrend series={netWorth.series} />}
      </section>

      <section style={{ margin: '2rem 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1rem', margin: 0 }}>Accounts</h2>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <PlaidLinkButton onLinked={() => load()} />
            <button className="btn-secondary" onClick={sync} disabled={syncing}>
              {syncing ? 'Syncing…' : 'Sync'}
            </button>
          </div>
        </div>
        {notice && <p style={{ color: 'var(--slate)' }}>{notice}</p>}
        {accounts?.length === 0 && (
          <p style={{ color: 'var(--slate)' }}>No accounts yet. Link a bank to pull balances.</p>
        )}
        {[...grouped.entries()].map(([type, list]) => (
          <div key={type} className="card" style={{ marginBottom: '0.75rem' }}>
            <p style={{ color: 'var(--slate)', margin: '0 0 0.5rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {TYPE_LABELS[type]}
            </p>
            {list.map((a) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0' }}>
                <span>
                  {a.name}
                  {a.institution && <span style={{ color: 'var(--slate)' }}> · {a.institution}</span>}
                </span>
                <span style={{ color: LIABILITY_TYPES.includes(type) ? 'var(--tulip-debt)' : 'inherit', fontVariantNumeric: 'tabular-nums' }}>
                  {LIABILITY_TYPES.includes(type) ? '−' : ''}
                  {formatUSDExact(a.balanceCents)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </section>

      <RecentTransactions />

      <FlintChat />
    </main>
  );
}

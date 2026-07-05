'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken, formatUSD, formatUSDExact, humanize } from '../../lib/api';
import { AppNav } from '../../components/AppNav';

interface ClientDto {
  id: string;
  email: string;
  since: string;
  netWorthCents: number;
}

interface OverviewDto {
  netWorth: { netWorthCents: number; assetsCents: number; liabilitiesCents: number };
  accounts: { name: string; type: string; balanceCents: number }[];
  debts: { name: string; type: string; balanceCents: number; aprBps: number }[];
  goals: { name: string; targetCents: number; savedCents: number; targetDate: string }[];
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientDto[] | null>(null);
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api<{ clients: ClientDto[] }>('/advisor/clients');
    setClients(res.clients);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    load().catch(() => undefined);
  }, [load, router]);

  async function addClient() {
    setNotice(null);
    try {
      const res = await api<{ client: { email: string } }>('/advisor/clients', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() }),
      });
      setNotice(`${res.client.email} added to your roster.`);
      setCode('');
      load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not add client');
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
      <AppNav />
      <h1 className="display" style={{ fontSize: '2rem', margin: '0 0 0.25rem' }}>
        Clients
      </h1>
      <p style={{ color: 'var(--slate)', margin: '0 0 1.5rem' }}>
        View-only dashboards for people who granted you access. You can look; you can never touch.
      </p>

      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '0.25rem' }}>Add a Client</h2>
        <p style={{ color: 'var(--slate)', fontSize: '0.88rem', margin: '0 0 1rem' }}>
          An access code is a one-time code your client creates for you. Ask them to open{' '}
          <strong>Sharing → Advisor access</strong> and tap <strong>Generate access code</strong>, then paste it here.
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <input className="field" style={{ flex: 1, minWidth: 180 }} placeholder="Paste the code your client gave you" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn-primary" disabled={!code.trim()} onClick={addClient}>
            Add client
          </button>
        </div>
        {notice && <p style={{ color: 'var(--slate)', margin: '0.6rem 0 0' }}>{notice}</p>}
      </section>

      {(clients ?? []).map((c) => (
        <ClientCard key={c.id} client={c} onRemoved={load} />
      ))}
      {clients?.length === 0 && (
        <p style={{ color: 'var(--slate)' }}>No clients yet — redeem an access code your client generated on their Sharing page.</p>
      )}
    </main>
  );
}

function ClientCard({ client, onRemoved }: { client: ClientDto; onRemoved: () => void }) {
  const [overview, setOverview] = useState<OverviewDto | null>(null);
  const [open, setOpen] = useState(false);

  async function toggle() {
    if (!open && !overview) {
      const res = await api<OverviewDto>(`/advisor/clients/${client.id}/overview`);
      setOverview(res);
    }
    setOpen(!open);
  }

  return (
    <div className="card" style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span>
          <strong>{client.email}</strong>
          <span style={{ color: 'var(--slate)', fontSize: '0.85rem' }}> · client since {client.since.slice(0, 10)}</span>
        </span>
        <span style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span className="numeric" style={{ fontWeight: 700 }}>
            {formatUSDExact(client.netWorthCents)}
          </span>
          <button className="btn-secondary" onClick={toggle}>
            {open ? 'Close' : 'View'}
          </button>
          <button
            className="btn-link"
            style={{ color: 'var(--tulip-debt)' }}
            onClick={() => api(`/advisor/clients/${client.id}`, { method: 'DELETE' }).then(onRemoved)}
          >
            remove
          </button>
        </span>
      </div>

      {open && overview && (
        <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
          <p style={{ margin: 0, color: 'var(--slate)' }}>
            {formatUSD(overview.netWorth.assetsCents)} assets · {formatUSD(overview.netWorth.liabilitiesCents)} owed
          </p>
          <div>
            <p className="eyebrow" style={{ marginBottom: '0.3rem' }}>
              Accounts
            </p>
            {overview.accounts.map((a, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.15rem 0' }}>
                <span>
                  {a.name} <span style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>{humanize(a.type)}</span>
                </span>
                <span className="numeric">{formatUSDExact(a.balanceCents)}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="eyebrow" style={{ marginBottom: '0.3rem' }}>
              Debts
            </p>
            {overview.debts.map((d, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.15rem 0' }}>
                <span>
                  {d.name} <span style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>{(d.aprBps / 100).toFixed(2)}%</span>
                </span>
                <span className="numeric" style={{ color: 'var(--tulip-debt)' }}>
                  {formatUSDExact(d.balanceCents)}
                </span>
              </div>
            ))}
            {overview.debts.length === 0 && <p style={{ color: 'var(--slate)', margin: 0 }}>No debts on record.</p>}
          </div>
          <div>
            <p className="eyebrow" style={{ marginBottom: '0.3rem' }}>
              Goals
            </p>
            {overview.goals.map((g, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.15rem 0' }}>
                <span>{g.name}</span>
                <span style={{ color: 'var(--slate)' }}>
                  {formatUSD(g.savedCents)} of {formatUSD(g.targetCents)} by {g.targetDate}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

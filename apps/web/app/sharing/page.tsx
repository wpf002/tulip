'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken, formatUSD } from '../../lib/api';
import { AppNav } from '../../components/AppNav';

interface HouseholdDto {
  household: {
    id: string;
    name: string;
    inviteCode: string;
    members: { id: string; email: string; you: boolean }[];
  } | null;
  sharedWithYou?: {
    goals: { id: string; name: string; targetCents: number; savedCents: number; owner: string }[];
    budgets: { id: string; category: string; monthlyLimitCents: number; owner: string }[];
  };
}

interface GoalDto {
  id: string;
  name: string;
  shared: boolean;
}

interface GrantDto {
  advisorId: string;
  email: string;
  since: string;
}

export default function SharingPage() {
  const router = useRouter();
  const [data, setData] = useState<HouseholdDto | null>(null);
  const [goals, setGoals] = useState<GoalDto[]>([]);
  const [grants, setGrants] = useState<GrantDto[]>([]);
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [grantCode, setGrantCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [h, g, a] = await Promise.all([
      api<HouseholdDto>('/household'),
      api<{ goals: GoalDto[] }>('/goals'),
      api<{ advisors: GrantDto[] }>('/advisor/grants'),
    ]);
    setData(h);
    setGoals(g.goals);
    setGrants(a.advisors);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    load().catch(() => undefined);
  }, [load, router]);

  async function act(fn: () => Promise<unknown>, done?: string) {
    setNotice(null);
    try {
      await fn();
      if (done) setNotice(done);
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
      <AppNav />
      <h1 className="display" style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>
        Sharing
      </h1>
      {notice && <p style={{ color: 'var(--tulip-property)' }}>{notice}</p>}

      {/* Household */}
      <section className="card" style={{ margin: '1.5rem 0' }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Household</h2>
        {!data?.household ? (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <p style={{ color: 'var(--slate)', margin: 0 }}>
              Share goals and budgets with a partner. Create a household or join theirs with an invite code.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <input className="field" placeholder="Household name" value={name} onChange={(e) => setName(e.target.value)} />
              <button
                className="btn-primary"
                disabled={!name.trim()}
                onClick={() => act(() => api('/household', { method: 'POST', body: JSON.stringify({ name }) }), 'Household created.')}
              >
                Create
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <input className="field" placeholder="Invite code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
              <button
                className="btn-secondary"
                disabled={!joinCode.trim()}
                onClick={() => act(() => api('/household/join', { method: 'POST', body: JSON.stringify({ code: joinCode.trim() }) }), 'Joined!')}
              >
                Join
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.9rem' }}>
            <p style={{ margin: 0 }}>
              <strong>{data.household.name}</strong>
              <span style={{ color: 'var(--slate)' }}>
                {' '}· invite code <code className="numeric">{data.household.inviteCode}</code>
              </span>
            </p>
            <div>
              <p className="eyebrow" style={{ marginBottom: '0.35rem' }}>
                Members
              </p>
              {data.household.members.map((m) => (
                <p key={m.id} style={{ margin: '0.15rem 0' }}>
                  {m.email}
                  {m.you && <span style={{ color: 'var(--slate)' }}> (you)</span>}
                </p>
              ))}
            </div>

            <div>
              <p className="eyebrow" style={{ marginBottom: '0.35rem' }}>
                Your goals — share with the household
              </p>
              {goals.map((g) => (
                <label key={g.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.2rem 0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={g.shared}
                    onChange={(e) =>
                      act(() => api(`/goals/${g.id}`, { method: 'PATCH', body: JSON.stringify({ shared: e.target.checked }) }))
                    }
                  />
                  {g.name}
                </label>
              ))}
            </div>

            {data.sharedWithYou && data.sharedWithYou.goals.length > 0 && (
              <div>
                <p className="eyebrow" style={{ marginBottom: '0.35rem' }}>
                  Shared with you
                </p>
                {data.sharedWithYou.goals.map((g) => (
                  <p key={g.id} style={{ margin: '0.15rem 0' }}>
                    {g.name}{' '}
                    <span style={{ color: 'var(--slate)' }}>
                      — {formatUSD(g.savedCents)} of {formatUSD(g.targetCents)} · {g.owner}
                    </span>
                  </p>
                ))}
              </div>
            )}

            <button className="btn-link" style={{ justifySelf: 'start' }} onClick={() => act(() => api('/household/leave', { method: 'POST' }), 'Left the household.')}>
              Leave household
            </button>
          </div>
        )}
      </section>

      {/* Advisor access */}
      <section className="card">
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Advisor Access</h2>
        <p style={{ color: 'var(--slate)', margin: '0 0 0.75rem' }}>
          Give a financial advisor a view-only window into your finances. They can look; they can never touch.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn-secondary"
            onClick={() =>
              act(async () => {
                const res = await api<{ code: string }>('/advisor/grant-code', { method: 'POST' });
                setGrantCode(res.code);
              })
            }
          >
            Generate access code
          </button>
          {grantCode && (
            <span>
              Give your advisor: <code className="numeric" style={{ fontSize: '1.05rem' }}>{grantCode}</code>{' '}
              <span style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>(one-time use)</span>
            </span>
          )}
        </div>
        {grants.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <p className="eyebrow" style={{ marginBottom: '0.35rem' }}>
              Who can see your finances
            </p>
            {grants.map((g) => (
              <p key={g.advisorId} style={{ margin: '0.2rem 0' }}>
                {g.email}
                <button
                  className="btn-link"
                  style={{ marginLeft: '0.75rem', color: 'var(--tulip-debt)' }}
                  onClick={() => act(() => api(`/advisor/grants/${g.advisorId}`, { method: 'DELETE' }), 'Access revoked.')}
                >
                  revoke
                </button>
              </p>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

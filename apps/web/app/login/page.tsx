'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ token: string }>(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(res.token);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 400, margin: '0 auto', padding: '6rem 1.5rem' }}>
      <h1 className="display" style={{ fontSize: '2.2rem', marginBottom: '0.25rem' }}>🌷 Tulip</h1>
      <p style={{ color: 'var(--slate)', marginBottom: '2rem' }}>
        {mode === 'login' ? 'Welcome back.' : 'Plant the first seed.'}
      </p>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '0.75rem' }}>
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password (8+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field"
        />
        {error && <p style={{ color: 'var(--tulip-debt)', margin: 0 }}>{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? '…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
      <button
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        className="btn-link"
        style={{ marginTop: '1rem' }}
      >
        {mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}
      </button>
    </main>
  );
}

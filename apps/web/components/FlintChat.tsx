'use client';

import { useState } from 'react';
import { api } from '../lib/api';

interface ChatEntry {
  role: 'user' | 'flint';
  text: string;
  grounded?: boolean;
}

/**
 * Flint chat panel. Every number Flint states is engine-computed — replies
 * flagged as ungrounded by the guardrail are visibly marked.
 */
export function FlintChat() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    const q = question.trim();
    if (!q || busy) return;
    setQuestion('');
    setEntries((prev) => [...prev, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const res = await api<{ answer: string; grounded: boolean }>('/flint/ask', {
        method: 'POST',
        body: JSON.stringify({ question: q }),
      });
      setEntries((prev) => [...prev, { role: 'flint', text: res.answer, grounded: res.grounded }]);
    } catch (err) {
      setEntries((prev) => [
        ...prev,
        { role: 'flint', text: err instanceof Error ? err.message : 'Flint is unavailable.' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        className="btn-primary"
        style={{ position: 'fixed', right: '1.5rem', bottom: '1.5rem', borderRadius: 999 }}
        onClick={() => setOpen(true)}
      >
        🔥 Ask Flint
      </button>
    );
  }

  return (
    <div
      className="card"
      style={{
        position: 'fixed',
        right: '1.5rem',
        bottom: '1.5rem',
        width: 360,
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <strong>🔥 Flint</strong>
        <button className="btn-link" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: '0.5rem', marginBottom: '0.6rem' }}>
        {entries.length === 0 && (
          <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>
            Ask about your numbers — e.g. “where should my next $500 go and why?” Flint only
            narrates what the engines computed; it never does its own math.
          </p>
        )}
        {entries.map((e, i) => (
          <div
            key={i}
            style={{
              background: e.role === 'user' ? 'var(--ink)' : 'var(--navy)',
              borderRadius: 8,
              padding: '0.5rem 0.7rem',
              fontSize: '0.9rem',
              whiteSpace: 'pre-wrap',
            }}
          >
            {e.text}
            {e.role === 'flint' && e.grounded === false && (
              <p style={{ color: 'var(--tulip-debt)', fontSize: '0.75rem', margin: '0.4rem 0 0' }}>
                ⚠ guardrail: contains numbers not traceable to engine output
              </p>
            )}
          </div>
        ))}
        {busy && <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>Flint is reading the engines…</p>}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          className="field"
          style={{ flex: 1 }}
          placeholder="Ask Flint…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="btn-primary" onClick={send} disabled={busy || !question.trim()}>
          →
        </button>
      </div>
    </div>
  );
}

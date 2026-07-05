'use client';

import { useState } from 'react';
import { api } from '../lib/api';
import { FlintFlame, WarningIcon } from './Icons';

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
        style={{ position: 'fixed', right: '1.5rem', bottom: '1.5rem', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
        onClick={() => setOpen(true)}
      >
        <FlintFlame size={16} /> Ask Flint
      </button>
    );
  }

  return (
    <div
      className="card flint-panel"
      style={{
        position: 'fixed',
        right: '1.5rem',
        bottom: '1.5rem',
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ color: '#f0a63a', display: 'inline-flex' }}>
            <FlintFlame size={16} />
          </span>
          Flint
        </strong>
        <button className="btn-link" aria-label="Close" onClick={() => setOpen(false)} style={{ fontSize: '1.1rem', lineHeight: 1 }}>
          ×
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: '0.5rem', marginBottom: '0.6rem' }}>
        {entries.length === 0 && (
          <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>
            Ask Flint anything about your money — like “where should my next $500 go?” Every number
            it gives you comes straight from your plan. It never makes one up.
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
              <p style={{ color: 'var(--tulip-debt)', fontSize: '0.75rem', margin: '0.4rem 0 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <WarningIcon size={13} /> This reply used a number we couldn&apos;t tie back to your plan — double-check it.
              </p>
            )}
          </div>
        ))}
        {busy && (
          <div className="typing" aria-label="Flint is thinking">
            <span />
            <span />
            <span />
          </div>
        )}
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

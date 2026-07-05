'use client';

import { useCallback, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { api } from '../lib/api';

interface Props {
  onLinked: () => void;
}

function LinkFlow({ linkToken, onLinked }: { linkToken: string; onLinked: () => void }) {
  const onSuccess = useCallback(
    async (publicToken: string, metadata: { institution?: { name?: string } | null }) => {
      await api('/plaid/exchange', {
        method: 'POST',
        body: JSON.stringify({
          publicToken,
          institutionName: metadata.institution?.name,
        }),
      });
      await api('/accounts/sync', { method: 'POST' });
      onLinked();
    },
    [onLinked],
  );

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  return (
    <button className="btn-primary" disabled={!ready} onClick={() => open()}>
      Continue in Plaid
    </button>
  );
}

export function PlaidLinkButton({ onLinked }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ linkToken: string }>('/plaid/link-token', { method: 'POST' });
      setLinkToken(res.linkToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Plaid Link');
    } finally {
      setBusy(false);
    }
  }

  if (linkToken) return <LinkFlow linkToken={linkToken} onLinked={onLinked} />;

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.35rem' }}>
      <button className="btn-primary" onClick={start} disabled={busy}>
        {busy ? '…' : 'Link Bank'}
      </button>
      {error && <span style={{ color: 'var(--tulip-debt)', fontSize: '0.85rem' }}>{error}</span>}
    </span>
  );
}

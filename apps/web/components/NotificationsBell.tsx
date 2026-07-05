'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import { BellIcon } from './Icons';

interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  read: boolean;
  createdAt: string;
}

/** Proactive nudges: the bell polls the trigger scan and lists what fired. */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationDto[]>([]);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ unreadCount: number; notifications: NotificationDto[] }>('/notifications');
      setUnread(res.unreadCount);
      setItems(res.notifications);
    } catch {
      /* not logged in or api down — bell stays quiet */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  async function markRead(id: string) {
    await api(`/notifications/${id}/read`, { method: 'POST' }).catch(() => undefined);
    load();
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        aria-label={`Notifications (${unread} unread)`}
        onClick={() => setOpen(!open)}
        style={{ background: 'none', border: 'none', color: 'var(--slate)', cursor: 'pointer', display: 'inline-flex', position: 'relative', padding: '0 0.2rem' }}
      >
        <BellIcon size={18} />
        {unread > 0 && (
          <span
            className="numeric"
            style={{
              background: 'var(--tulip-debt)',
              borderRadius: 999,
              color: '#fff',
              fontSize: '0.62rem',
              fontWeight: 700,
              padding: '0.05rem 0.32rem',
              position: 'absolute',
              right: -6,
              top: -4,
            }}
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="card"
          style={{ position: 'absolute', right: 0, top: '2rem', width: 340, zIndex: 60, maxHeight: '60vh', overflowY: 'auto', padding: '0.9rem' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
            <strong style={{ fontSize: '0.9rem' }}>Notifications</strong>
            {unread > 0 && (
              <button className="btn-link" style={{ fontSize: '0.75rem' }} onClick={() => api('/notifications/read-all', { method: 'POST' }).then(load)}>
                mark all read
              </button>
            )}
          </div>
          {items.length === 0 && <p style={{ color: 'var(--slate)', fontSize: '0.85rem', margin: 0 }}>Nothing yet — you&apos;re all caught up.</p>}
          {items.map((n) => (
            <div key={n.id} style={{ borderTop: '1px solid var(--hairline)', opacity: n.read ? 0.55 : 1, padding: '0.6rem 0' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.2rem' }}>{n.title}</p>
              <p style={{ color: 'var(--slate)', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>{n.body}</p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.35rem' }}>
                {n.actionUrl && (
                  <Link href={n.actionUrl} className="btn-link" style={{ fontSize: '0.75rem' }} onClick={() => markRead(n.id)}>
                    Take a look →
                  </Link>
                )}
                {!n.read && (
                  <button className="btn-link" style={{ fontSize: '0.75rem' }} onClick={() => markRead(n.id)}>
                    dismiss
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

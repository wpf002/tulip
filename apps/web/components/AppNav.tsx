'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken } from '../lib/api';
import { NotificationsBell } from './NotificationsBell';

const LINKS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/debt', label: 'Debt freedom' },
  { href: '/goals', label: 'Goals' },
  { href: '/budget', label: 'Budget' },
  { href: '/property', label: 'Property' },
  { href: '/sharing', label: 'Sharing' },
  { href: '/clients', label: 'Clients' },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="app-nav">
      <Link href="/dashboard" className="wordmark">
        🌷 Tulip
      </Link>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={`nav-link${pathname === l.href ? ' active' : ''}`}>
          {l.label}
        </Link>
      ))}
      <NotificationsBell />
      <button
        className="btn-link"
        onClick={() => {
          clearToken();
          router.push('/login');
        }}
      >
        Log out
      </button>
    </nav>
  );
}

import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import './globals.css';

// Self-hosted (apps/web/fonts, SIL OFL) so builds never fetch from Google Fonts.
const fraunces = localFont({
  src: [
    { path: '../fonts/fraunces-latin.woff2', style: 'normal' },
    { path: '../fonts/fraunces-latin-italic.woff2', style: 'italic' },
  ],
  weight: '100 900',
  variable: '--font-display',
  display: 'swap',
});

export const metadata = {
  title: 'Tulip — Grow wealth wisely',
  description:
    'Tulip tells you where your next dollar should go, not just where your last one went. Every number is calculated, never made up.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
  appleWebApp: { capable: true, title: 'Tulip', statusBarStyle: 'black-translucent' as const },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f1b2d',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fraunces.variable}>
      <body>{children}</body>
    </html>
  );
}

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
    'Tulip prescribes your next dollar, not just reports your last one. Every number engine-computed, never AI-invented.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fraunces.variable}>
      <body>{children}</body>
    </html>
  );
}

import type { ReactNode } from 'react';
import { Fraunces } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  axes: ['opsz', 'SOFT', 'WONK'],
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

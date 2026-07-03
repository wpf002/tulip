import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Tulip — Grow wealth wisely',
  description: 'Know what you have. Plan where it grows.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🌷 Tulip</h1>
      <p style={{ color: 'var(--slate)', fontSize: '1.15rem' }}>
        Know what you have. Plan where it grows.
      </p>
      <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem' }}>
        <Link href="/login" className="btn-primary" style={{ textDecoration: 'none' }}>
          Get started
        </Link>
        <Link href="/dashboard" className="btn-secondary" style={{ textDecoration: 'none' }}>
          Open dashboard
        </Link>
      </div>
    </main>
  );
}

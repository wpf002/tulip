import Link from 'next/link';
import { TulipLogo, FlintFlame, CheckIcon } from '../components/Icons';

/**
 * Editorial landing page. Light, generous whitespace, serif display type —
 * the app itself stays dark navy. Every stat here is honest: Tulip does the
 * math in tested code, and the advisor only explains what that code produced.
 */

const FEATURES = [
  {
    title: 'A real debt-free date',
    color: 'var(--tulip-debt)',
    body: 'An actual date, not a progress bar. See avalanche versus snowball side by side, with the exact dollars snowball costs you — and watch the date shift as you move a slider.',
  },
  {
    title: 'Where your next dollar goes',
    color: 'var(--tulip-property)',
    body: 'Tell Tulip you have $500 to spare. It ranks every place that dollar could land — the employer match always comes first — adjusts for taxes, and splits it down to the cent.',
  },
  {
    title: 'Honest goal trade-offs',
    color: 'var(--tulip-retire)',
    body: 'Rental down payment or student loans? Slide the split and watch both dates move. No more guessing what the trade-off actually costs you.',
  },
  {
    title: 'One-tap budget sweeps',
    color: 'var(--tulip-property)',
    body: 'Under budget this month? One tap sends the extra to your priciest debt and tells you exactly how many months sooner you pay it off.',
  },
  {
    title: 'Rental deal check',
    color: 'var(--tulip-property)',
    body: 'Cap rate, cash-on-cash, monthly cashflow, and whether it covers the mortgage — on any rental you are weighing, with the mortgage math done right.',
  },
  {
    title: 'A financial health score',
    color: 'var(--tulip-debt)',
    body: 'One number from 0 to 100, with the reasons behind it in plain sight: your cash cushion, how heavy your debt is, how much you save, and which way your net worth is headed.',
  },
];

const STATS = [
  { value: '100%', label: 'of your numbers are calculated, never guessed' },
  { value: '90', label: 'hand-checked tests behind every figure' },
  { value: '0', label: 'numbers the advisor is allowed to make up' },
  { value: '1¢', label: 'we count in whole cents, never rough estimates' },
];

function ProductPreview() {
  return (
    <div
      style={{
        background: 'var(--navy)',
        border: '1px solid rgba(15, 27, 45, 0.2)',
        borderRadius: 20,
        boxShadow: '0 32px 80px rgba(15, 27, 45, 0.25)',
        color: 'var(--offwhite)',
        padding: '1.75rem',
      }}
    >
      <p className="eyebrow" style={{ color: 'var(--slate)' }}>
        Debt-free date
      </p>
      <p className="display" style={{ color: 'var(--tulip-debt)', fontSize: '2.6rem', margin: 0 }}>
        March 2032
      </p>
      <p style={{ color: 'var(--slate)', fontSize: '0.9rem', margin: '0.35rem 0 1.25rem' }}>
        68 months · $6,059.52 total interest · Avalanche
      </p>
      <svg viewBox="0 0 320 80" style={{ width: '100%', display: 'block' }} aria-hidden>
        <path
          d="M4,10 L44,18 L84,25 L124,33 L164,42 L204,52 L244,61 L284,70 L316,76"
          fill="none"
          stroke="var(--tulip-property)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={316} cy={76} r={4} fill="var(--tulip-property)" />
      </svg>
      <div
        style={{
          background: 'var(--navy-soft)',
          border: '1px solid rgba(63, 155, 92, 0.5)',
          borderRadius: 12,
          fontSize: '0.85rem',
          marginTop: '1.25rem',
          padding: '0.9rem 1rem',
        }}
      >
        You&apos;re <strong>$800</strong> under budget. Sweep it to the Visa — debt-free{' '}
        <strong style={{ color: 'var(--tulip-property)' }}>31 months sooner</strong>, saving{' '}
        <strong>$7,248.26</strong> in interest?
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="light-page">
      {/* Nav */}
      <header
        style={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'space-between',
          margin: '0 auto',
          maxWidth: 1100,
          padding: '1.5rem',
        }}
      >
        <span className="display" style={{ fontSize: '1.35rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <TulipLogo size={24} />
          Tulip
        </span>
        <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Link href="/login" className="btn-ghost-navy">
            Log in
          </Link>
          <Link href="/login" className="btn-navy">
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section
        className="hero-grid"
        style={{ margin: '0 auto', maxWidth: 1100, padding: '4rem 1.5rem 5rem' }}
      >
        <div>
          <p className="eyebrow">Wealth management for the rest of us</p>
          <h1 className="display" style={{ fontSize: 'clamp(2.6rem, 5.5vw, 4rem)', margin: '0 0 1.25rem' }}>
            Know what you have. Plan where it <em>grows</em>.
          </h1>
          <p style={{ color: 'var(--slate-dark)', fontSize: '1.18rem', lineHeight: 1.6, margin: '0 0 2rem', maxWidth: 480 }}>
            Most money apps just tell you what you already spent. Tulip shows you what to do next: a
            debt-free date you can actually move, goals that lay out their real trade-offs, and an
            advisor that can&apos;t fudge the numbers.
          </p>
          <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap' }}>
            <Link href="/login" className="btn-navy">
              Plant the first seed →
            </Link>
            <a href="#how" className="btn-ghost-navy">
              See how it works
            </a>
          </div>
          <p style={{ color: 'var(--slate-dark)', fontSize: '0.85rem', marginTop: '1.25rem' }}>
            Free while in preview · your keys, your data · no advice sold to you
          </p>
        </div>
        <ProductPreview />
      </section>

      {/* Stat strip */}
      <section style={{ borderBlock: '1px solid var(--hairline-light)', background: 'var(--paper)' }}>
        <div
          style={{
            display: 'grid',
            gap: '2rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            margin: '0 auto',
            maxWidth: 1100,
            padding: '2.75rem 1.5rem',
          }}
        >
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="display numeric" style={{ fontSize: '2.4rem', margin: 0 }}>
                {s.value}
              </p>
              <p style={{ color: 'var(--slate-dark)', fontSize: '0.9rem', margin: '0.3rem 0 0' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ margin: '0 auto', maxWidth: 1100, padding: '5rem 1.5rem' }}>
        <p className="eyebrow" style={{ textAlign: 'center' }}>
          What Tulip does
        </p>
        <h2 className="display" style={{ fontSize: 'clamp(1.9rem, 3.5vw, 2.6rem)', margin: '0 auto 3rem', maxWidth: 620, textAlign: 'center' }}>
          One place where every dollar has a job — and a date
        </h2>
        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {FEATURES.map((f) => (
            <div key={f.title} className="light-card">
              <div style={{ background: f.color, borderRadius: 999, height: 6, marginBottom: '1.1rem', width: 42 }} />
              <h3 className="display" style={{ fontSize: '1.3rem', margin: '0 0 0.6rem' }}>
                {f.title}
              </h3>
              <p style={{ color: 'var(--slate-dark)', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Flint */}
      <section style={{ background: 'var(--navy)', color: 'var(--offwhite)' }}>
        <div
          className="hero-grid"
          style={{ margin: '0 auto', maxWidth: 1100, padding: '5rem 1.5rem' }}
        >
          <div>
            <p className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: '#f0a63a', display: 'inline-flex' }}>
                <FlintFlame size={14} />
              </span>
              Meet Flint
            </p>
            <h2 className="display" style={{ fontSize: 'clamp(1.9rem, 3.5vw, 2.6rem)', margin: '0 0 1.1rem' }}>
              An advisor that <em>never</em> makes the numbers up
            </h2>
            <p style={{ color: 'var(--slate)', fontSize: '1.05rem', lineHeight: 1.65, margin: 0 }}>
              Ask “where should my next $500 go?” and Flint walks you through the answer your plan
              already worked out — nothing more. Every reply gets checked: if a number can&apos;t be
              traced to your real plan, it&apos;s flagged right there in the chat. No made-up figures,
              ever.
            </p>
          </div>
          <div className="card" style={{ fontSize: '0.92rem' }}>
            <p style={{ background: 'var(--ink)', borderRadius: 10, margin: '0 0 0.7rem', padding: '0.7rem 0.9rem' }}>
              Where should my next $500 go, and why?
            </p>
            <p style={{ background: 'var(--navy)', border: '1px solid var(--hairline)', borderRadius: 10, margin: 0, padding: '0.7rem 0.9rem', lineHeight: 1.6 }}>
              First, $200 goes to your 401(k) match — that&apos;s an instant 57% effective return no
              debt payoff can beat. The remaining $300 belongs on the Visa at 22.99% APR, which
              moves your debt-free date to <strong>April 2028</strong>.
              <span style={{ color: 'var(--tulip-property)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', marginTop: '0.6rem' }}>
                <CheckIcon size={13} /> Every number here traces back to your plan
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{ margin: '0 auto', maxWidth: 1100, padding: '5rem 1.5rem' }}>
        <p className="eyebrow" style={{ textAlign: 'center' }}>
          How it works
        </p>
        <h2 className="display" style={{ fontSize: 'clamp(1.9rem, 3.5vw, 2.6rem)', margin: '0 auto 3rem', textAlign: 'center' }}>
          Three steps to your first plan
        </h2>
        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {[
            ['01', 'Connect', 'Link your accounts or type in a few balances. Anything sensitive is encrypted before it ever hits the database — never stored as plain text.'],
            ['02', 'See', 'Your net worth, a debt-free date, goal timelines, and a health score — all worked out to the cent.'],
            ['03', 'Act', 'Move a slider, accept a sweep, put a windfall to work. Tulip shows you exactly what each choice does before you make it.'],
          ].map(([n, title, body]) => (
            <div key={n} style={{ borderTop: '1px solid var(--hairline-light)', paddingTop: '1.5rem' }}>
              <p className="display numeric" style={{ color: 'var(--tulip-property)', fontSize: '1rem', margin: '0 0 0.5rem' }}>
                {n}
              </p>
              <h3 className="display" style={{ fontSize: '1.4rem', margin: '0 0 0.5rem' }}>
                {title}
              </h3>
              <p style={{ color: 'var(--slate-dark)', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section style={{ background: 'var(--navy)', color: 'var(--offwhite)', textAlign: 'center' }}>
        <div style={{ margin: '0 auto', maxWidth: 640, padding: '5rem 1.5rem' }}>
          <h2 className="display" style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', margin: '0 0 1rem' }}>
            Your next dollar deserves a plan
          </h2>
          <p style={{ color: 'var(--slate)', fontSize: '1.05rem', margin: '0 0 2rem' }}>
            Takes about two minutes to see your debt-free date.
          </p>
          <Link href="/login" className="btn-primary" style={{ fontSize: '1.05rem', padding: '0.9rem 2rem', textDecoration: 'none' }}>
            Get started free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: 'var(--ink)', color: 'var(--slate)' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            justifyContent: 'space-between',
            margin: '0 auto',
            maxWidth: 1100,
            padding: '2rem 1.5rem',
            fontSize: '0.85rem',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <TulipLogo size={18} /> Tulip — know what you have, plan where it grows.
          </span>
          <span>Preview software. Not investment, legal, or tax advice.</span>
        </div>
      </footer>
    </div>
  );
}

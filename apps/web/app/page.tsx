import Link from 'next/link';

/**
 * Editorial landing page. Light, generous whitespace, serif display type —
 * the app itself stays dark navy. Every stat here is honest: this product's
 * trust story is "engines compute, AI only narrates."
 */

const FEATURES = [
  {
    title: 'Debt Freedom Engine',
    color: 'var(--tulip-debt)',
    body: 'A real debt-free date, not a progress bar. Avalanche vs. snowball with the exact dollar cost of choosing feelings over math — recomputed live as you move a slider.',
  },
  {
    title: 'Marginal Dollar Router',
    color: 'var(--tulip-property)',
    body: 'Tell Tulip you have $500 spare. It ranks every place that dollar could go — employer match first, always — with tax-adjusted returns, and splits it to the cent.',
  },
  {
    title: 'Goal Tradeoffs, Quantified',
    color: 'var(--tulip-retire)',
    body: 'Rental down payment vs. student loans? Slide the allocation and watch both projected dates move. No more guessing what the tradeoff actually costs.',
  },
  {
    title: 'Budget Sweeps',
    color: 'var(--tulip-property)',
    body: 'Under budget this month? One tap sweeps the surplus to your highest-return debt and shows precisely how many months sooner you become debt-free.',
  },
  {
    title: 'Property Analyzer',
    color: 'var(--tulip-property)',
    body: 'Cap rate, cash-on-cash, DSCR, and monthly cashflow on any prospective rental — with the mortgage leg run through a real amortization engine.',
  },
  {
    title: 'Financial Health Score',
    color: 'var(--tulip-debt)',
    body: 'One 0–100 number with fully transparent drivers: liquidity, rate-weighted debt burden, savings rate, and trajectory. Watch it move as you act.',
  },
];

const STATS = [
  { value: '100%', label: 'of numbers computed by deterministic engines' },
  { value: '82', label: 'hand-checked tests behind every figure' },
  { value: '0', label: 'numbers the AI is allowed to invent' },
  { value: '1¢', label: 'precision — money is integer cents, never floats' },
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
        68 months · $6,059.52 total interest · avalanche
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
        <span className="display" style={{ fontSize: '1.35rem' }}>
          🌷 Tulip
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
            Know what you have.
            <br />
            Plan where it <em>grows</em>.
          </h1>
          <p style={{ color: 'var(--slate-dark)', fontSize: '1.18rem', lineHeight: 1.6, margin: '0 0 2rem', maxWidth: 480 }}>
            Every budgeting app reports your last dollar. Tulip prescribes your next one — a
            debt-free date you can steer, goals with honest tradeoffs, and an AI advisor that is
            never allowed to do its own math.
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
            <p className="eyebrow">🔥 Meet Flint</p>
            <h2 className="display" style={{ fontSize: 'clamp(1.9rem, 3.5vw, 2.6rem)', margin: '0 0 1.1rem' }}>
              An AI advisor that <em>never</em> does its own math
            </h2>
            <p style={{ color: 'var(--slate)', fontSize: '1.05rem', lineHeight: 1.65, margin: 0 }}>
              Ask “where should my next $500 go and why?” Flint narrates exactly what the engines
              computed — nothing more. A guardrail checks every reply: any number that can&apos;t be
              traced back to engine output is flagged, visibly, in the chat. That&apos;s our answer to
              AI hallucinating your finances.
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
              <span style={{ color: 'var(--tulip-property)', display: 'block', fontSize: '0.78rem', marginTop: '0.6rem' }}>
                ✓ guardrail: every number traced to engine output
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
          Three steps to your first prescription
        </h2>
        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {[
            ['01', 'Connect', 'Link accounts through Plaid or add balances by hand. Access tokens are encrypted at rest — never stored in plain text.'],
            ['02', 'See', 'Net worth, a debt-free date, goal timelines, and a health score — every figure computed by tested engines, to the cent.'],
            ['03', 'Act', 'Move a slider, accept a sweep, route a windfall. Tulip shows the exact consequence of each choice before you make it.'],
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
          <span>🌷 Tulip — know what you have, plan where it grows.</span>
          <span>Preview software. Not investment, legal, or tax advice.</span>
        </div>
      </footer>
    </div>
  );
}

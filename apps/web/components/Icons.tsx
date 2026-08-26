/**
 * Inline SVG icon set — no emoji anywhere in the UI.
 * Icons that should take on surrounding text color use `currentColor`;
 * the tulip mark carries its own brand colors.
 */

export function TulipLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M6 7 9 5.6 10.6 8 12 5.2 13.4 8 15 5.6 18 7 16.4 12.4 7.6 12.4Z" fill="#e35b47" />
      <rect x="11" y="12" width="2" height="8.6" rx="0.4" fill="#2e7a46" />
      <path d="M11 15.4 6.8 16.4 6.3 20 11 18.6Z" fill="#3f9b5c" />
    </svg>
  );
}

export function BellIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block' }}>
      <path d="M6 9a6 6 0 0 1 12 0c0 4 1.4 5.5 2 6H4c.6-.5 2-2 2-6Z" />
      <path d="M10.3 20a1.8 1.8 0 0 0 3.4 0" />
    </svg>
  );
}

export function Spark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ display: 'block' }}>
      <path d="M12.5 2c2.6 3.6-1.4 5.3-1.4 8.6a2 2 0 0 0 4 .2c0-.7-.2-1.4-.6-2 2 1.1 3.3 3.2 3.3 5.6a6 6 0 1 1-12 0c0-3.4 3.7-4.8 3.7-8 0-1.2-.4-2.3-1-3.2 1.4.3 2.7 1 4 2.1-.3-1.2-.9-2.3-1.7-3.3Z" />
    </svg>
  );
}

export function WarningIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px' }}>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 10v4" />
      <path d="M12 17.5v.01" />
    </svg>
  );
}

export function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px' }}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function PencilIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-1px' }}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}

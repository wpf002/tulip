/**
 * Guardrail: Flint NEVER does arithmetic. Every number in a Flint response must
 * already exist in the engine-computed context it was given. This module is
 * pure and unit-testable without any network access.
 */

/**
 * Extract every numeric token from text, normalized for comparison:
 * "$1,234.56" -> "1234.56", "7.80%" -> "7.8", "120" -> "120".
 * Trailing zeros after the decimal point are trimmed so 108.80 == 108.8.
 */
export function extractNumbers(text: string): string[] {
  const matches = text.match(/-?\$?\d[\d,]*(?:\.\d+)?%?/g) ?? [];
  return matches.map((raw) => {
    let s = raw.replace(/[$,%]/g, '').replace(/,/g, '');
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s.startsWith('-')) s = `-${s.slice(1).replace(/^0+(?=\d)/, '')}`;
    else s = s.replace(/^0+(?=\d)/, '');
    return s;
  });
}

/** Collect every number reachable in a structured context object. */
export function contextNumbers(context: unknown): Set<string> {
  const found = new Set<string>();
  const visit = (value: unknown): void => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      addVariants(found, value);
    } else if (typeof value === 'string') {
      for (const n of extractNumbers(value)) found.add(n);
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(visit);
    }
  };
  visit(context);
  return found;
}

/**
 * A cents value may legitimately be narrated as dollars ("threshold at the
 * edge"): 123456 may appear as 123456, 1234.56, or rounded 1235 / 1234.
 * We whitelist those *presentation* variants — they are formatting, not math.
 */
function addVariants(set: Set<string>, value: number): void {
  const norm = (n: number) => {
    let s = String(n);
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  };
  set.add(norm(value));
  if (Number.isInteger(value)) {
    const dollars = value / 100;
    set.add(norm(dollars));
    set.add(norm(Math.round(dollars)));
    set.add(norm(Math.floor(dollars)));
    // percentages stored as decimals (0.078) may be narrated as 7.8
    }
  if (!Number.isInteger(value) && Math.abs(value) < 1) {
    set.add(norm(value * 100)); // 0.078 -> 7.8 (%)
    set.add(norm(Math.round(value * 10000) / 100)); // rounding to 2dp
  }
}

/** Small numbers that are ordinary language, not financial claims. */
const BENIGN = new Set(['0', '1', '2', '3', '10', '100', '120']);

export interface GroundingResult {
  grounded: boolean;
  novelNumbers: string[];
}

/**
 * Verify that every number in `response` is present in (a variant of) the
 * engine context. Returns the offending numbers so callers can reject or flag.
 */
export function verifyGrounded(response: string, context: unknown): GroundingResult {
  const allowed = contextNumbers(context);
  const novel = extractNumbers(response).filter((n) => !allowed.has(n) && !BENIGN.has(n));
  return { grounded: novel.length === 0, novelNumbers: [...new Set(novel)] };
}

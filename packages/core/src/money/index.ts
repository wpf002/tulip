/**
 * Money primitives. LOCKED INVARIANT: all money is integer cents. No floats, ever.
 * A `Cents` is a whole number of cents (e.g. $1,234.56 => 123456).
 * Arithmetic here is exact; formatting/parsing at the edges only.
 */

export type Cents = number & { readonly __brand: 'Cents' };

export function cents(n: number): Cents {
  if (!Number.isInteger(n)) {
    throw new Error(`Cents must be an integer, got ${n}. Money never uses floats.`);
  }
  return n as Cents;
}

/** Parse a dollar string/number ("1234.56", 1234.56) to integer cents. Rounds half-up. */
export function fromDollars(dollars: number | string): Cents {
  const value = typeof dollars === 'string' ? Number(dollars) : dollars;
  if (Number.isNaN(value)) throw new Error(`Cannot parse dollars: ${dollars}`);
  return cents(Math.round(value * 100));
}

export function toDollars(c: Cents): number {
  return c / 100;
}

export function add(a: Cents, b: Cents): Cents {
  return cents(a + b);
}

export function sub(a: Cents, b: Cents): Cents {
  return cents(a - b);
}

/** Multiply cents by a unitless rate (e.g. interest). Rounds half-up to whole cents. */
export function mulRate(a: Cents, rate: number): Cents {
  return cents(Math.round(a * rate));
}

export function isZero(a: Cents): boolean {
  return a === 0;
}

export function isPositive(a: Cents): boolean {
  return a > 0;
}

export function max(...values: Cents[]): Cents {
  if (values.length === 0) throw new Error('max requires at least one value');
  return values.reduce((m, v) => (v > m ? v : m)) as Cents;
}

export function min(...values: Cents[]): Cents {
  if (values.length === 0) throw new Error('min requires at least one value');
  return values.reduce((m, v) => (v < m ? v : m)) as Cents;
}

/**
 * Split `total` across `weights` with no penny lost. Largest-remainder method.
 * Sum of the result always equals `total`. Used by the reallocation + goal engines.
 */
export function allocate(total: Cents, weights: number[]): Cents[] {
  const weightSum = weights.reduce((s, w) => s + w, 0);
  if (weightSum <= 0) throw new Error('allocate requires positive weights');
  const raw = weights.map((w) => (total * w) / weightSum);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = total - floors.reduce((s, f) => s + f, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (let k = 0; k < remainder; k++) {
    result[order[k % order.length]!.i]! += 1;
  }
  return result.map((n) => cents(n));
}

export const ZERO = cents(0);

export function formatUSD(c: Cents): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(toDollars(c));
}

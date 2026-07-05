const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('tulip_token');
}

export function setToken(token: string) {
  window.localStorage.setItem('tulip_token', token);
}

export function clearToken() {
  window.localStorage.removeItem('tulip_token');
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/')) {
    clearToken();
    window.location.href = '/login';
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof body?.error === 'string' ? body.error : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return body as T;
}

// ---- Typed payloads (all money is integer cents; format at the edge only) ----

export interface AccountDto {
  id: string;
  name: string;
  type: 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'INVESTMENT' | 'RETIREMENT' | 'LOAN' | 'CASH';
  institution: string | null;
  balanceCents: number;
  currency: string;
  updatedAt: string;
}

export interface NetWorthDto {
  netWorthCents: number;
  assetsCents: number;
  liabilitiesCents: number;
  series: { date: string; netWorthCents: number }[];
}

export function formatUSD(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatUSDExact(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

/** Turn a machine string ("STUDENT_LOAN", "credit_card") into "Student Loan". */
export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

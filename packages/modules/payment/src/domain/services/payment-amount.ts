/**
 * Pure decimal money arithmetic in integer minor units.
 *
 * Money is stored as `numeric(10,2)` and surfaces as strings (node-postgres
 * returns NUMERIC as text). We convert to integer minor units for arithmetic so
 * we NEVER touch floating point (0.1 + 0.2 != 0.3). All functions are pure and
 * framework-agnostic — the single place payment money math lives.
 *
 * To avoid silent NaN/Infinity drift, conversions throw on malformed input
 * rather than coercing.
 */

const MONEY_PATTERN = /^-?\d+(?:\.\d{1,2})?$/;

function assertMoney(amount: string): void {
  if (!MONEY_PATTERN.test(amount.trim())) {
    throw new Error(`Invalid monetary value: "${amount}" (expected e.g. "1234.56").`);
  }
}

/** Converts a decimal money string to integer minor units (e.g. "12.34" → 1234). */
export function toMinorUnits(amount: string): number {
  assertMoney(amount);
  const negative = amount.trim().startsWith('-');
  const absolute = negative ? amount.trim().slice(1) : amount.trim();
  const parts = absolute.split('.');
  const whole = parts[0] ?? '0';
  const fraction = (parts[1] ?? '').padEnd(2, '0').slice(0, 2);
  return (parseInt(whole, 10) * 100 + parseInt(fraction, 10)) * (negative ? -1 : 1);
}

/** Converts integer minor units back to a decimal string (1234 → "12.34"). */
export function fromMinorUnits(units: number): string {
  const negative = units < 0;
  const absolute = Math.abs(units);
  const whole = String(Math.floor(absolute / 100));
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/** Sums decimal money strings in minor units. */
export function sumMoney(amounts: readonly string[]): string {
  const total = amounts.reduce((acc, amount) => acc + toMinorUnits(amount), 0);
  return fromMinorUnits(total);
}

/** Compares `a >= b` numerically. Throws on malformed input (delegates to toMinorUnits). */
export function gteMoney(a: string, b: string): boolean {
  return toMinorUnits(a) >= toMinorUnits(b);
}

/** Compares `a > b` numerically. Throws on malformed input (delegates to toMinorUnits). */
export function gtMoney(a: string, b: string): boolean {
  return toMinorUnits(a) > toMinorUnits(b);
}

/** True when the amount is strictly greater than zero. */
export function isPositiveMoney(amount: string): boolean {
  return toMinorUnits(amount) > 0;
}

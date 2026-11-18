const SCALE = 8;
const FACTOR = 10n ** BigInt(SCALE);

/** Parse a non-negative decimal string into a fixed-point bigint. */
function parseFixed(value: string, label: string): bigint {
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error(`${label} must be a plain non-negative decimal`);
  }
  const [whole, fraction = ''] = value.split('.');
  const padded = (fraction + '0'.repeat(SCALE)).slice(0, SCALE);
  return BigInt(whole) * FACTOR + BigInt(padded);
}

function formatFixed(value: bigint): string {
  const whole = value / FACTOR;
  const fraction = (value % FACTOR).toString().padStart(SCALE, '0');
  return `${whole}.${fraction}`;
}

/**
 * Convert `amount` using `rate` with exact decimal arithmetic (no floating
 * point drift). Rejects NaN, negative and zero rates.
 */
export function convertPrice(amount: string, rate: string): string {
  const fixedRate = parseFixed(rate, 'rate');
  if (fixedRate === 0n) throw new Error('rate must be greater than zero');
  const fixedAmount = parseFixed(amount, 'amount');
  return formatFixed((fixedAmount * fixedRate) / FACTOR);
}

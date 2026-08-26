/** Default platform fee fraction (2%). */
export const DEFAULT_PLATFORM_FEE_RATE = 0.02;

/** Number of stroops in one Stellar Lumen (1 XLM = 10,000,000 Stroops). */
export const STROOPS_PER_LUMEN = 10_000_000;

/**
 * Calculates the platform fee for a given gross transaction amount.
 *
 * @param amount - The gross amount in USDC/XLM
 * @param feeRate - The platform fee fraction (default: 0.02 / 2%)
 * @returns The calculated platform fee rounded to 7 decimal places
 */
export function calculatePlatformFee(
  amount: number | string,
  feeRate = DEFAULT_PLATFORM_FEE_RATE,
): number {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount) || numAmount <= 0) {
    return 0;
  }
  const fee = numAmount * feeRate;
  return roundToDecimals(fee, 7);
}

/**
 * Formats a numeric USDC amount into a standard 2-decimal currency string.
 * Example: `1234.5` -> `"1,234.50"`
 *
 * @param amount - The numeric or string amount
 * @param decimals - Decimal places (default: 2)
 * @returns Formatted currency string
 */
export function formatUsdc(amount: number | string, decimals = 2): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) {
    return '0.00';
  }
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Converts Stellar Stroops (integer) to Lumens / native unit (decimal).
 *
 * @param stroops - Number of stroops (1 XLM = 10^7 stroops)
 * @returns Equivalent decimal amount
 */
export function stroopsToLumens(stroops: number | string | bigint): number {
  const num = typeof stroops === 'bigint' ? Number(stroops) : Number(stroops);
  if (isNaN(num)) return 0;
  return num / STROOPS_PER_LUMEN;
}

/**
 * Converts Lumens / standard token units to integer Stroops.
 *
 * @param lumens - Token amount in standard units
 * @returns Integer stroop count
 */
export function lumensToStroops(lumens: number | string): number {
  const num = typeof lumens === 'string' ? parseFloat(lumens) : lumens;
  if (isNaN(num)) return 0;
  return Math.round(num * STROOPS_PER_LUMEN);
}

/**
 * Validates whether a value is a positive, finite numeric monetary amount.
 *
 * @param amount - Value to validate
 * @returns True if valid positive monetary amount
 */
export function isValidAmount(amount: unknown): boolean {
  if (typeof amount === 'number') {
    return !isNaN(amount) && isFinite(amount) && amount > 0;
  }
  if (typeof amount === 'string') {
    const parsed = parseFloat(amount.trim());
    return !isNaN(parsed) && isFinite(parsed) && parsed > 0;
  }
  return false;
}

/**
 * Rounds a number to a specified number of decimal places without floating-point drift.
 *
 * @param value - Number or numeric string
 * @param decimals - Decimal precision (default: 7 for Stellar precision)
 * @returns Rounded number
 */
export function roundToDecimals(value: number | string, decimals = 7): number {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

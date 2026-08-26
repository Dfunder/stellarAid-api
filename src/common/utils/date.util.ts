/**
 * Formats a Date object or timestamp into an ISO string (UTC).
 *
 * @param date - Date object, ISO string, or epoch timestamp
 * @returns Formatted ISO 8601 string
 */
export function formatIsoDate(date: Date | string | number = new Date()): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    return new Date().toISOString();
  }
  return d.toISOString();
}

/**
 * Calculates the total number of whole calendar days between two dates.
 *
 * @param startDate - Starting date
 * @param endDate - Ending date
 * @returns Absolute count of full days
 */
export function daysBetween(startDate: Date | string, endDate: Date | string): number {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 0;
  }
  const diffMs = Math.abs(end.getTime() - start.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Adds or subtracts a specified number of days from a given date.
 *
 * @param date - Source date
 * @param days - Number of days to add (negative numbers subtract)
 * @returns New Date instance
 */
export function addDays(date: Date | string, days: number): Date {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  if (isNaN(d.getTime())) return new Date();
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Checks if a given date is in the past compared to the current system time.
 *
 * @param date - Date to evaluate
 * @returns True if date is before now
 */
export function isPastDate(date: Date | string): boolean {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

/**
 * Checks if a given date is in the future compared to the current system time.
 *
 * @param date - Date to evaluate
 * @returns True if date is after now
 */
export function isFutureDate(date: Date | string): boolean {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return false;
  return d.getTime() > Date.now();
}

/**
 * Returns a new Date set to the start of the calendar day (00:00:00.000 UTC).
 *
 * @param date - Source date
 * @returns Date at midnight UTC
 */
export function startOfDayUtc(date: Date | string = new Date()): Date {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  if (isNaN(d.getTime())) return new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns a new Date set to the end of the calendar day (23:59:59.999 UTC).
 *
 * @param date - Source date
 * @returns Date at end of day UTC
 */
export function endOfDayUtc(date: Date | string = new Date()): Date {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  if (isNaN(d.getTime())) return new Date();
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

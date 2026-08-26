import * as crypto from 'crypto';

/**
 * Converts a string into a URL-friendly slug.
 * Example: `"Digital Illustration & Concept Art!"` -> `"digital-illustration-concept-art"`
 *
 * @param text - The text to slugify
 * @returns Lowercase hyphen-separated slug string
 */
export function slugify(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .normalize('NFD') // decompose accents
    .replace(/[\u0300-\u036f]/g, '') // remove accent marks
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // remove invalid characters
    .replace(/[\s_-]+/g, '-') // collapse whitespace and underscores into single hyphens
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens
}

/**
 * Truncates text to a maximum character length, appending an ellipsis or custom suffix.
 *
 * @param text - The string to truncate
 * @param maxLength - Maximum permitted length
 * @param suffix - Suffix to append when truncated (default: '...')
 * @returns Truncated string
 */
export function truncate(text: string, maxLength: number, suffix = '...'): string {
  if (!text || typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, Math.max(0, maxLength - suffix.length)) + suffix;
}

/**
 * Masks an email address for privacy and secure display in audit logs or notifications.
 * Example: `"artist@stellaraid.com"` -> `"a***t@stellaraid.com"`
 *
 * @param email - The email address to mask
 * @returns Masked email string
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return email || '';
  }
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0]}*@${domain}`;
  }
  const first = localPart[0];
  const last = localPart[localPart.length - 1];
  const maskedLocal = `${first}${'*'.repeat(Math.max(1, localPart.length - 2))}${last}`;
  return `${maskedLocal}@${domain}`;
}

/**
 * Capitalizes the first letter of a string.
 * Example: `"illustration"` -> `"Illustration"`
 *
 * @param text - The string to capitalize
 * @returns Capitalized string
 */
export function capitalize(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Generates a cryptographically secure numeric One-Time Password (OTP).
 *
 * @param length - Length of OTP digits (default: 6)
 * @returns String of random numeric digits
 */
export function generateOtp(length = 6): string {
  if (length <= 0) length = 6;
  const digits = '0123456789';
  const bytes = crypto.randomBytes(length);
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[bytes[i] % 10];
  }
  return otp;
}

/**
 * Generates a cryptographically secure random alphanumeric string.
 *
 * @param length - Desired string length (default: 32)
 * @returns Random alphanumeric string
 */
export function generateRandomString(length = 32): string {
  if (length <= 0) length = 32;
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

/**
 * Basic sanitization of strings to prevent common XSS characters in plain text fields.
 *
 * @param str - Input text
 * @returns Escaped text safe from basic script injection
 */
export function sanitizeHtml(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

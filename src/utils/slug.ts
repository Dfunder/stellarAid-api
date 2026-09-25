/**
 * Slug generation.
 */

/** Lowercase, URL-safe slug (letters/digits joined by single hyphens). */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

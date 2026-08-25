import { Transform } from 'class-transformer';

export function SanitizeString() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    return value
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/<[^>]*>/g, '')
      .trim();
  });
}

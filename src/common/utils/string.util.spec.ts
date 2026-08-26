import {
  slugify,
  truncate,
  maskEmail,
  capitalize,
  generateOtp,
  generateRandomString,
  sanitizeHtml,
} from './string.util';

describe('StringUtil', () => {
  describe('slugify', () => {
    it('should convert strings to lowercase hyphen-separated slugs', () => {
      expect(slugify('Digital Illustration & Concept Art!')).toBe(
        'digital-illustration-concept-art',
      );
      expect(slugify('  Hello World -- 2026  ')).toBe('hello-world-2026');
      expect(slugify('Café & Crème')).toBe('cafe-creme');
    });

    it('should handle empty or null strings', () => {
      expect(slugify('')).toBe('');
      expect(slugify(null as any)).toBe('');
    });
  });

  describe('truncate', () => {
    it('should truncate strings exceeding maxLength', () => {
      expect(truncate('This is a long description for a service', 20)).toBe(
        'This is a long de...',
      );
    });

    it('should return original string if within limit', () => {
      expect(truncate('Short text', 20)).toBe('Short text');
    });

    it('should support custom suffix', () => {
      expect(truncate('Hello World', 8, ' [more]')).toBe('H [more]');
    });
  });

  describe('maskEmail', () => {
    it('should mask email addresses safely', () => {
      expect(maskEmail('artist@stellaraid.com')).toBe('a****t@stellaraid.com');
      expect(maskEmail('jo@test.com')).toBe('j*@test.com');
      expect(maskEmail('a@test.com')).toBe('a*@test.com');
    });

    it('should return original or empty if invalid', () => {
      expect(maskEmail('')).toBe('');
      expect(maskEmail('notanemail')).toBe('notanemail');
    });
  });

  describe('capitalize', () => {
    it('should capitalize the first character', () => {
      expect(capitalize('illustration')).toBe('Illustration');
      expect(capitalize('BRANDING')).toBe('BRANDING');
      expect(capitalize('')).toBe('');
    });
  });

  describe('generateOtp', () => {
    it('should generate a numeric string of requested length', () => {
      const otp6 = generateOtp(6);
      expect(otp6).toMatch(/^\d{6}$/);

      const otp4 = generateOtp(4);
      expect(otp4).toMatch(/^\d{4}$/);
    });
  });

  describe('generateRandomString', () => {
    it('should generate random string of specified length', () => {
      const str = generateRandomString(16);
      expect(str.length).toBe(16);
    });
  });

  describe('sanitizeHtml', () => {
    it('should escape HTML tags and special entities', () => {
      expect(sanitizeHtml('<script>alert("XSS")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;',
      );
      expect(sanitizeHtml("He's & She's")).toBe('He&#039;s &amp; She&#039;s');
    });
  });
});

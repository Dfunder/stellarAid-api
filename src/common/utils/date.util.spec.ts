import {
  formatIsoDate,
  daysBetween,
  addDays,
  isPastDate,
  isFutureDate,
  startOfDayUtc,
  endOfDayUtc,
} from './date.util';

describe('DateUtil', () => {
  describe('formatIsoDate', () => {
    it('should format dates into ISO string', () => {
      const date = new Date('2026-08-26T12:00:00Z');
      expect(formatIsoDate(date)).toBe('2026-08-26T12:00:00.000Z');
    });

    it('should handle epoch numbers and string inputs', () => {
      const iso = formatIsoDate('2026-01-01T00:00:00.000Z');
      expect(iso).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  describe('daysBetween', () => {
    it('should calculate days difference between two dates', () => {
      const d1 = new Date('2026-01-01');
      const d2 = new Date('2026-01-11');
      expect(daysBetween(d1, d2)).toBe(10);
      expect(daysBetween(d2, d1)).toBe(10);
    });

    it('should return 0 for same dates or invalid inputs', () => {
      const d1 = new Date('2026-01-01');
      expect(daysBetween(d1, d1)).toBe(0);
      expect(daysBetween('invalid', d1)).toBe(0);
    });
  });

  describe('addDays', () => {
    it('should add days to a date', () => {
      const date = new Date('2026-01-01T00:00:00Z');
      const result = addDays(date, 5);
      expect(result.getDate()).toBe(6);
    });

    it('should subtract days when passed a negative number', () => {
      const date = new Date('2026-01-10T00:00:00Z');
      const result = addDays(date, -3);
      expect(result.getDate()).toBe(7);
    });
  });

  describe('isPastDate and isFutureDate', () => {
    it('should correctly identify past and future dates', () => {
      const past = new Date(Date.now() - 100000);
      const future = new Date(Date.now() + 100000);

      expect(isPastDate(past)).toBe(true);
      expect(isPastDate(future)).toBe(false);

      expect(isFutureDate(future)).toBe(true);
      expect(isFutureDate(past)).toBe(false);
    });
  });

  describe('startOfDayUtc and endOfDayUtc', () => {
    it('should set UTC time to start of day', () => {
      const date = new Date('2026-05-15T16:30:45.123Z');
      const start = startOfDayUtc(date);
      expect(start.getUTCHours()).toBe(0);
      expect(start.getUTCMinutes()).toBe(0);
      expect(start.getUTCSeconds()).toBe(0);
      expect(start.getUTCMilliseconds()).toBe(0);
    });

    it('should set UTC time to end of day', () => {
      const date = new Date('2026-05-15T16:30:45.123Z');
      const end = endOfDayUtc(date);
      expect(end.getUTCHours()).toBe(23);
      expect(end.getUTCMinutes()).toBe(59);
      expect(end.getUTCSeconds()).toBe(59);
      expect(end.getUTCMilliseconds()).toBe(999);
    });
  });
});

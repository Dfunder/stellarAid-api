import {
  calculatePlatformFee,
  formatUsdc,
  stroopsToLumens,
  lumensToStroops,
  isValidAmount,
  roundToDecimals,
  DEFAULT_PLATFORM_FEE_RATE,
} from './currency.util';

describe('CurrencyUtil', () => {
  describe('calculatePlatformFee', () => {
    it('should calculate 2% fee by default', () => {
      expect(calculatePlatformFee(100)).toBe(2);
      expect(calculatePlatformFee(500)).toBe(10);
      expect(calculatePlatformFee('250')).toBe(5);
    });

    it('should handle custom fee rates', () => {
      expect(calculatePlatformFee(100, 0.05)).toBe(5);
    });

    it('should return 0 for zero, negative or invalid amounts', () => {
      expect(calculatePlatformFee(0)).toBe(0);
      expect(calculatePlatformFee(-50)).toBe(0);
      expect(calculatePlatformFee('invalid')).toBe(0);
    });
  });

  describe('formatUsdc', () => {
    it('should format numbers with comma and two decimals', () => {
      expect(formatUsdc(1234.5)).toBe('1,234.50');
      expect(formatUsdc(1000000)).toBe('1,000,000.00');
      expect(formatUsdc('50.25')).toBe('50.25');
    });

    it('should return default 0.00 for invalid strings', () => {
      expect(formatUsdc('not-a-number')).toBe('0.00');
    });
  });

  describe('stroopsToLumens and lumensToStroops', () => {
    it('should convert stroops to lumens correctly', () => {
      expect(stroopsToLumens(10_000_000)).toBe(1);
      expect(stroopsToLumens(50_000_000)).toBe(5);
      expect(stroopsToLumens(100)).toBe(0.00001);
    });

    it('should convert lumens to stroops correctly', () => {
      expect(lumensToStroops(1)).toBe(10_000_000);
      expect(lumensToStroops('2.5')).toBe(25_000_000);
    });
  });

  describe('isValidAmount', () => {
    it('should return true for valid positive amounts', () => {
      expect(isValidAmount(100)).toBe(true);
      expect(isValidAmount(0.01)).toBe(true);
      expect(isValidAmount('500.50')).toBe(true);
    });

    it('should return false for zero, negative, NaN or invalid types', () => {
      expect(isValidAmount(0)).toBe(false);
      expect(isValidAmount(-10)).toBe(false);
      expect(isValidAmount('abc')).toBe(false);
      expect(isValidAmount(null)).toBe(false);
      expect(isValidAmount(undefined)).toBe(false);
    });
  });

  describe('roundToDecimals', () => {
    it('should round numbers to specified decimal places', () => {
      expect(roundToDecimals(1.23456789, 2)).toBe(1.23);
      expect(roundToDecimals(1.23456789, 4)).toBe(1.2346);
      expect(roundToDecimals('10.555', 2)).toBe(10.56);
    });
  });
});

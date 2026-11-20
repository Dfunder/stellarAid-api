import { convertPrice } from './convert-price';
import { canRetryRefund, nextStatusOnRetry } from './refund-state';

describe('convertPrice', () => {
  it('multiplies exactly', () => {
    expect(convertPrice('0.1', '3')).toBe('0.30000000');
    expect(convertPrice('10', '0.5')).toBe('5.00000000');
  });

  it('rejects bad rates', () => {
    expect(() => convertPrice('1', 'NaN')).toThrow();
    expect(() => convertPrice('1', '0')).toThrow();
    expect(() => convertPrice('1', '-2')).toThrow();
  });
});

describe('refund state', () => {
  it('allows retrying FAILED refunds', () => {
    expect(canRetryRefund('FAILED')).toBe(true);
    expect(nextStatusOnRetry('FAILED')).toBe('PENDING');
    expect(canRetryRefund('COMPLETED')).toBe(false);
  });
});

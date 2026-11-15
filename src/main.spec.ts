import { parsePort } from './main';

describe('parsePort', () => {
  it('defaults to 3000 when PORT is unset', () => {
    expect(parsePort(undefined)).toBe(3000);
  });

  it('defaults to 3000 when PORT is empty or whitespace', () => {
    expect(parsePort('')).toBe(3000);
    expect(parsePort('   ')).toBe(3000);
  });

  it('honors valid numeric ports', () => {
    expect(parsePort('3000')).toBe(3000);
    expect(parsePort('8080')).toBe(8080);
    expect(parsePort(' 4000 ')).toBe(4000);
  });

  it('accepts the boundaries of the valid port range', () => {
    expect(parsePort('1')).toBe(1);
    expect(parsePort('65535')).toBe(65535);
  });

  it('rejects non-numeric values', () => {
    expect(() => parsePort('abc')).toThrow('Invalid PORT "abc"');
  });

  it('rejects out-of-range values', () => {
    expect(() => parsePort('0')).toThrow('Invalid PORT "0"');
    expect(() => parsePort('65536')).toThrow('Invalid PORT "65536"');
    expect(() => parsePort('-1')).toThrow('Invalid PORT "-1"');
  });

  it('rejects non-integer and non-finite values', () => {
    expect(() => parsePort('3000.5')).toThrow('Invalid PORT "3000.5"');
    expect(() => parsePort('NaN')).toThrow('Invalid PORT "NaN"');
    expect(() => parsePort('Infinity')).toThrow('Invalid PORT "Infinity"');
  });

  it('reports the expected range in the error message', () => {
    expect(() => parsePort('70000')).toThrow(/between 1 and 65535/);
  });
});

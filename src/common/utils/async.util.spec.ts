import { sleep, retryWithBackoff, withTimeout } from './async.util';

describe('AsyncUtil', () => {
  describe('sleep', () => {
    it('should sleep for specified duration', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });

  describe('retryWithBackoff', () => {
    it('should return result if operation succeeds immediately', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await retryWithBackoff(fn, { maxRetries: 3 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const onRetry = jest.fn();
      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelayMs: 10,
        backoffFactor: 1.5,
        onRetry,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
      expect(onRetry).toHaveBeenCalledTimes(2);
    });

    it('should throw error if maximum retries are exhausted', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Persistent error'));

      await expect(
        retryWithBackoff(fn, {
          maxRetries: 2,
          initialDelayMs: 10,
        }),
      ).rejects.toThrow('Persistent error');

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('withTimeout', () => {
    it('should resolve before timeout', async () => {
      const promise = sleep(20).then(() => 'done');
      const result = await withTimeout(promise, 200);
      expect(result).toBe('done');
    });

    it('should reject if operation exceeds timeout', async () => {
      const slowPromise = sleep(200).then(() => 'slow');
      await expect(
        withTimeout(slowPromise, 30, 'Custom timeout error'),
      ).rejects.toThrow('Custom timeout error');
    });
  });
});

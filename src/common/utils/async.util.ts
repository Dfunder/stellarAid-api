/**
 * Pauses asynchronous execution for the specified number of milliseconds.
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the timeout
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

export interface RetryOptions {
  /** Maximum number of attempts (including the first try). Default: 3 */
  maxRetries?: number;
  /** Initial delay before first retry in milliseconds. Default: 200ms */
  initialDelayMs?: number;
  /** Multiplier for exponential backoff. Default: 2 */
  backoffFactor?: number;
  /** Maximum delay between retries. Default: 5000ms */
  maxDelayMs?: number;
  /** Optional callback invoked on error before waiting to retry */
  onRetry?: (error: unknown, attempt: number) => void;
}

/**
 * Retries an asynchronous function with exponential backoff upon failure.
 *
 * @param fn - The async function to execute
 * @param options - Configuration options for retry attempts and backoff
 * @returns Resolved value of fn
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 200,
    backoffFactor = 2,
    maxDelayMs = 5000,
    onRetry,
  } = options;

  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    try {
      attempt++;
      return await fn();
    } catch (error) {
      if (attempt >= maxRetries) {
        throw error;
      }
      if (onRetry) {
        onRetry(error, attempt);
      }
      await sleep(delay);
      delay = Math.min(delay * backoffFactor, maxDelayMs);
    }
  }
}

/**
 * Wraps a promise with a maximum execution time limit. Throws an Error if timed out.
 *
 * @param promise - The promise to await
 * @param timeoutMs - Maximum allowed duration in milliseconds
 * @param errorMessage - Custom error message for timeout rejection
 * @returns Resolved value of the promise
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = `Operation timed out after ${timeoutMs}ms`,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

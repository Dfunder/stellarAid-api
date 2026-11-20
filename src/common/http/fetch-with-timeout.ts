export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

/** `fetch` that aborts after `timeoutMs` instead of hanging forever. */
export function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal =
    init.signal == null ? timeout : AbortSignal.any([init.signal, timeout]);
  return fetch(input, { ...init, signal });
}

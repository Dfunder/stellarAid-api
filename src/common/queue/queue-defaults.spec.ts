import { attachErrorListener, DAILY_JOB_OPTIONS } from './queue-defaults';

describe('queue defaults', () => {
  it('logs emitted errors instead of throwing', () => {
    const logged: string[] = [];
    let handler: ((error: Error) => void) | undefined;
    attachErrorListener(
      { on: (_event, listener) => (handler = listener) },
      'worker',
      'media',
      { error: (message: unknown) => void logged.push(String(message)) },
    );
    handler?.(new Error('ECONNRESET'));
    expect(logged[0]).toContain('ECONNRESET');
  });

  it('retries daily jobs', () => {
    expect(DAILY_JOB_OPTIONS.attempts).toBeGreaterThan(1);
  });
});

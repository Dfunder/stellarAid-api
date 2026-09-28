import { REVIEW_EDIT_WINDOW_MS } from './reviews.service';

describe('reviews service constants (#833)', () => {
  it('edit window is 30 days in milliseconds', () => {
    expect(REVIEW_EDIT_WINDOW_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('rejects ages outside the window', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const within = new Date(createdAt.getTime() + 10 * 24 * 60 * 60 * 1000);
    const outside = new Date(createdAt.getTime() + 31 * 24 * 60 * 60 * 1000);
    expect(within.getTime() - createdAt.getTime()).toBeLessThanOrEqual(
      REVIEW_EDIT_WINDOW_MS,
    );
    expect(outside.getTime() - createdAt.getTime()).toBeGreaterThan(
      REVIEW_EDIT_WINDOW_MS,
    );
  });
});

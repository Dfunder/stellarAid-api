interface Entry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Small TTL cache with prefix invalidation. Every write path that changes the
 * cached data must call `invalidate`/`invalidatePrefix` — route all of them
 * through one helper (e.g. `invalidateUnreadNotifications(userId)`) so no
 * write site can bypass it.
 */
export class KeyedCache<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }

  invalidate(key: string): void {
    this.entries.delete(key);
  }

  invalidatePrefix(prefix: string): number {
    let removed = 0;
    for (const key of [...this.entries.keys()]) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}

export const unreadNotificationsKey = (userId: string): string =>
  `notifications:unread:${userId}`;

import { KeyedCache, unreadNotificationsKey } from './keyed-cache';

describe('KeyedCache', () => {
  it('expires entries after the ttl', () => {
    let now = 0;
    const cache = new KeyedCache<number>(100, () => now);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    now = 101;
    expect(cache.get('a')).toBeUndefined();
  });

  it('invalidates by prefix', () => {
    const cache = new KeyedCache<number>(1000);
    cache.set(unreadNotificationsKey('u1'), 3);
    cache.set(unreadNotificationsKey('u2'), 5);
    expect(cache.invalidatePrefix('notifications:unread:')).toBe(2);
    expect(cache.get(unreadNotificationsKey('u1'))).toBeUndefined();
  });
});

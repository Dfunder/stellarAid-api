import {
  pick,
  omit,
  cleanUndefined,
  groupBy,
  chunk,
  deepClone,
} from './object.util';

describe('ObjectUtil', () => {
  describe('pick', () => {
    it('should pick only specified keys from object', () => {
      const obj = { id: '1', name: 'Alice', role: 'ADMIN', age: 30 };
      const picked = pick(obj, ['id', 'name']);
      expect(picked).toEqual({ id: '1', name: 'Alice' });
    });

    it('should ignore keys not present on object', () => {
      const obj = { a: 1 };
      const picked = pick(obj, ['a', 'b' as any]);
      expect(picked).toEqual({ a: 1 });
    });
  });

  describe('omit', () => {
    it('should omit specified keys from object', () => {
      const obj = { id: '1', passwordHash: 'secret', name: 'Alice' };
      const omitted = omit(obj, ['passwordHash']);
      expect(omitted).toEqual({ id: '1', name: 'Alice' });
      expect((omitted as any).passwordHash).toBeUndefined();
    });
  });

  describe('cleanUndefined', () => {
    it('should strip undefined properties', () => {
      const obj = { a: 1, b: undefined, c: null, d: 'hello' };
      const cleaned = cleanUndefined(obj);
      expect(cleaned).toEqual({ a: 1, c: null, d: 'hello' });
      expect('b' in cleaned).toBe(false);
    });
  });

  describe('groupBy', () => {
    it('should group array elements by key', () => {
      const items = [
        { category: 'ILLUSTRATION', title: 'Art 1' },
        { category: 'UI_UX', title: 'Design 1' },
        { category: 'ILLUSTRATION', title: 'Art 2' },
      ];
      const grouped = groupBy(items, (item) => item.category);
      expect(grouped['ILLUSTRATION']).toHaveLength(2);
      expect(grouped['UI_UX']).toHaveLength(1);
    });
  });

  describe('chunk', () => {
    it('should split array into chunks of given size', () => {
      const array = [1, 2, 3, 4, 5, 6, 7];
      const chunks = chunk(array, 3);
      expect(chunks).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    });

    it('should handle empty or invalid arrays', () => {
      expect(chunk([], 3)).toEqual([]);
      expect(chunk([1, 2], 0)).toEqual([]);
    });
  });

  describe('deepClone', () => {
    it('should perform deep cloning of complex objects', () => {
      const original = {
        name: 'Commission',
        date: new Date('2026-01-01'),
        nested: { tags: ['art', 'nft'] },
      };
      const copy = deepClone(original);
      expect(copy).toEqual(original);
      expect(copy).not.toBe(original);
      expect(copy.nested).not.toBe(original.nested);
      expect(copy.date).toBeInstanceOf(Date);
      expect(copy.date.getTime()).toBe(original.date.getTime());
    });
  });
});

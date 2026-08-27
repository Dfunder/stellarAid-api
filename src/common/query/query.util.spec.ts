import { BadRequestException } from '@nestjs/common';
import {
  buildPaginationMeta,
  containsFilter,
  parseSort,
  rangeFilter,
} from './query.util';

const ALLOWED = ['priceUsdc', 'createdAt'] as const;

describe('query.util', () => {
  describe('parseSort', () => {
    it('parses multiple fields with directions', () => {
      expect(parseSort('priceUsdc:asc,createdAt:desc', ALLOWED)).toEqual([
        { priceUsdc: 'asc' },
        { createdAt: 'desc' },
      ]);
    });

    it('defaults missing direction to asc', () => {
      expect(parseSort('priceUsdc', ALLOWED)).toEqual([{ priceUsdc: 'asc' }]);
    });

    it('rejects a non-allowed field', () => {
      expect(() => parseSort('secret:asc', ALLOWED)).toThrow(
        BadRequestException,
      );
    });

    it('rejects an invalid direction', () => {
      expect(() => parseSort('priceUsdc:sideways', ALLOWED)).toThrow(
        BadRequestException,
      );
    });

    it('returns an empty array for no sort', () => {
      expect(parseSort(undefined, ALLOWED)).toEqual([]);
    });
  });

  describe('rangeFilter', () => {
    it('builds gte/lte bounds', () => {
      expect(rangeFilter(10, 100)).toEqual({ gte: 10, lte: 100 });
    });
    it('returns undefined when no bounds given', () => {
      expect(rangeFilter()).toBeUndefined();
    });
  });

  describe('containsFilter', () => {
    it('builds an insensitive contains filter', () => {
      expect(containsFilter('logo')).toEqual({
        contains: 'logo',
        mode: 'insensitive',
      });
    });
    it('returns undefined for empty input', () => {
      expect(containsFilter()).toBeUndefined();
    });
  });

  describe('buildPaginationMeta', () => {
    it('produces full standardized metadata', () => {
      expect(buildPaginationMeta(45, 2, 20)).toEqual({
        total: 45,
        page: 2,
        limit: 20,
        offset: 20,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });
  });
});

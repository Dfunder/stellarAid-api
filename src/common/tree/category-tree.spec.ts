import { buildCategoryTree, CategoryTreeError } from './category-tree';

const row = (id: string, parentId: string | null) => ({
  id,
  name: id,
  slug: id,
  parentId,
});

describe('buildCategoryTree', () => {
  it('nests one level', () => {
    const tree = buildCategoryTree([row('a', null), row('b', 'a')]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].id).toBe('b');
  });

  it('rejects cycles', () => {
    expect(() => buildCategoryTree([row('a', 'b'), row('b', 'a')])).toThrow(
      CategoryTreeError,
    );
  });
});

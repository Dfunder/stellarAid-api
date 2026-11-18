export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

export interface CategoryNode extends CategoryRow {
  children: CategoryNode[];
}

export const MAX_CATEGORY_DEPTH = 1;

export class CategoryTreeError extends Error {}

/**
 * Build the category tree from flat rows that only select the rendered
 * columns. Walks iteratively with a visited set so a cycle (A -> B -> A)
 * raises a clean error instead of a stack overflow, and refuses trees deeper
 * than the documented one-level contract.
 */
export function buildCategoryTree(rows: CategoryRow[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>();
  for (const row of rows) nodes.set(row.id, { ...row, children: [] });

  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    const seen = new Set<string>([node.id]);
    let depth = 0;
    let cursor = node.parentId === null ? undefined : nodes.get(node.parentId);
    while (cursor !== undefined) {
      if (seen.has(cursor.id)) {
        throw new CategoryTreeError(`Category cycle detected at ${cursor.id}`);
      }
      seen.add(cursor.id);
      depth += 1;
      cursor =
        cursor.parentId === null ? undefined : nodes.get(cursor.parentId);
    }
    if (depth > MAX_CATEGORY_DEPTH) {
      throw new CategoryTreeError(`Category ${node.id} is nested too deep`);
    }

    const parent = node.parentId === null ? undefined : nodes.get(node.parentId);
    if (parent === undefined) roots.push(node);
    else parent.children.push(node);
  }
  return roots;
}

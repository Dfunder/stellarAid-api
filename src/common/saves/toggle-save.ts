const UNIQUE_VIOLATION = 'P2002';

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

export interface SaveStore {
  exists(): Promise<boolean>;
  create(): Promise<void>;
  remove(): Promise<void>;
}

/**
 * Toggle a saved item. Two concurrent "save" requests both see "not saved" and
 * both insert; the loser hits a unique violation. That means the item is now
 * saved, so treat it as success instead of surfacing a 500.
 */
export async function toggleSave(store: SaveStore): Promise<{ saved: boolean }> {
  if (await store.exists()) {
    await store.remove();
    return { saved: false };
  }

  try {
    await store.create();
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  return { saved: true };
}

/**
 * Portfolio reorder input must be a permutation of the existing ids: no
 * duplicates, nothing missing, nothing unknown.
 */
export function validateReorder(
  requestedIds: string[],
  existingIds: string[],
): void {
  if (new Set(requestedIds).size !== requestedIds.length) {
    throw new Error('Reorder list contains duplicate ids');
  }
  const existing = new Set(existingIds);
  const sameSize = requestedIds.length === existing.size;
  if (!sameSize || requestedIds.some((id) => !existing.has(id))) {
    throw new Error('Reorder list must contain exactly the existing ids');
  }
}

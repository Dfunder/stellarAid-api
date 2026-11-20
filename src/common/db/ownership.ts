/**
 * Ownership checks only need the owner column, never the whole row. Use this
 * as the `select` of a `findUnique` so large JSON columns are not fetched:
 *
 *   const row = await prisma.artwork.findUnique({
 *     where: { id },
 *     select: OWNER_ONLY_SELECT,
 *   });
 *   assertOwner(row, userId);
 */
export const OWNER_ONLY_SELECT = { ownerId: true } as const;

export interface OwnedRow {
  ownerId: string;
}

export function isOwner(row: OwnedRow | null | undefined, userId: string) {
  return row !== null && row !== undefined && row.ownerId === userId;
}

export function assertOwner(
  row: OwnedRow | null | undefined,
  userId: string,
): void {
  if (!isOwner(row, userId)) {
    throw new Error('Resource not found');
  }
}

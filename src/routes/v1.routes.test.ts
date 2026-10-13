import { describe, expect, it } from 'vitest';

import { categoriesRouter } from './categories.routes';
import { v1Router } from './v1.routes';

interface RouterLayer {
  readonly handle: unknown;
}

describe('v1 router mounts', () => {
  it('mounts the categories router exactly once', () => {
    const layers = (v1Router as unknown as { stack: readonly RouterLayer[] }).stack;
    const categoryMounts = layers.filter((layer) => layer.handle === categoriesRouter);

    expect(categoryMounts).toHaveLength(1);
  });
});

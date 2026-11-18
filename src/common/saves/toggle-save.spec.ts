import { toggleSave, validateReorder } from './toggle-save';

describe('toggleSave', () => {
  it('treats a unique violation as already saved', async () => {
    const result = await toggleSave({
      exists: () => Promise.resolve(false),
      create: () => Promise.reject({ code: 'P2002' }),
      remove: () => Promise.resolve(),
    });
    expect(result).toEqual({ saved: true });
  });
});

describe('validateReorder', () => {
  it('rejects duplicates and unknown ids', () => {
    expect(() => validateReorder(['a', 'a'], ['a', 'b'])).toThrow();
    expect(() => validateReorder(['a', 'c'], ['a', 'b'])).toThrow();
    expect(() => validateReorder(['b', 'a'], ['a', 'b'])).not.toThrow();
  });
});

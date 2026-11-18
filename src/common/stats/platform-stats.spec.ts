import { computePlatformStats } from './platform-stats';

describe('computePlatformStats', () => {
  it('skips drafts and keeps assets separate', () => {
    const stats = computePlatformStats([
      { published: true, asset: 'USDC', amount: 10 },
      { published: true, asset: 'XLM', amount: 100 },
      { published: false, asset: 'USDC', amount: 999 },
    ]);
    expect(stats).toEqual({
      publishedCount: 2,
      volumeByAsset: { USDC: 10, XLM: 100 },
    });
  });
});

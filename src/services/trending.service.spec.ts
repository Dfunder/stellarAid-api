import { TrendingService } from './trending.service';

const HOUR_MS = 60 * 60 * 1000;

describe('TrendingService', () => {
  it('decays the stored score and weights a new event by its age', () => {
    const service = new TrendingService(Math.LN2);

    expect(
      service.updateScore(
        { score: 8, updatedAt: 0 },
        2,
        HOUR_MS,
        HOUR_MS,
      ),
    ).toEqual({ score: 6, updatedAt: HOUR_MS });
  });

  it('decays a score over time even when no new event is added', () => {
    const service = new TrendingService(Math.LN2);

    expect(
      service.updateScore({ score: 8, updatedAt: 0 }, 0, 0, HOUR_MS),
    ).toEqual({ score: 4, updatedAt: HOUR_MS });
  });

  it('allows decay to be disabled and does not boost future-dated events', () => {
    const service = new TrendingService(0);

    expect(
      service.updateScore({ score: 3, updatedAt: HOUR_MS }, 2, 2 * HOUR_MS, 0),
    ).toEqual({ score: 5, updatedAt: 0 });
  });
});

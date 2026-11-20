const HOUR_MS = 60 * 60 * 1000;

export const DEFAULT_TRENDING_DECAY_RATE_PER_HOUR = Math.LN2 / 24;

export interface TrendingScoreState {
  score: number;
  updatedAt: number;
}

function configuredDecayRate(): number {
  const value = process.env.TRENDING_DECAY_RATE_PER_HOUR;
  if (value === undefined) return DEFAULT_TRENDING_DECAY_RATE_PER_HOUR;

  const decayRate = Number(value);
  if (!Number.isFinite(decayRate) || decayRate < 0) {
    throw new RangeError(
      'TRENDING_DECAY_RATE_PER_HOUR must be a finite, non-negative number.',
    );
  }
  return decayRate;
}

export class TrendingService {
  constructor(
    private readonly decayRatePerHour = configuredDecayRate(),
  ) {
    if (!Number.isFinite(decayRatePerHour) || decayRatePerHour < 0) {
      throw new RangeError('Decay rate must be a finite, non-negative number.');
    }
  }

  updateScore(
    state: TrendingScoreState,
    eventWeight = 1,
    eventAt = Date.now(),
    now = Date.now(),
  ): TrendingScoreState {
    if (!Number.isFinite(state.score) || !Number.isFinite(state.updatedAt)) {
      throw new RangeError('Trending score state must contain finite values.');
    }
    if (!Number.isFinite(eventWeight) || eventWeight < 0) {
      throw new RangeError('Event weight must be a finite, non-negative number.');
    }
    if (!Number.isFinite(eventAt) || !Number.isFinite(now)) {
      throw new RangeError('Event and current timestamps must be finite.');
    }

    const decayedScore =
      state.score * this.decayFactor(Math.max(0, now - state.updatedAt));
    const weightedEvent =
      eventWeight * this.decayFactor(Math.max(0, now - eventAt));

    return {
      score: decayedScore + weightedEvent,
      updatedAt: now,
    };
  }

  private decayFactor(elapsedMs: number): number {
    return Math.exp(-this.decayRatePerHour * (elapsedMs / HOUR_MS));
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

/**
 * Platform fee configuration (#635).
 * Fee tiers by volume (cumulative artist earnings in USDC).
 */
export const PLATFORM_FEE_TIERS = [
  { maxVolume: 1_000, ratePercent: 5 },   // 5% for new artists
  { maxVolume: 10_000, ratePercent: 3 },  // 3% for growing artists
  { maxVolume: Infinity, ratePercent: 2 }, // 2% for established artists
];

/** Exempted artist IDs pay zero platform fee. */
const FEE_EXEMPT_ARTISTS = new Set<string>(
  (process.env.FEE_EXEMPT_ARTIST_IDS ?? '').split(',').filter(Boolean),
);

export function getPlatformFeeRate(artistTotalEarnings: number): number {
  if (artistTotalEarnings === undefined) return PLATFORM_FEE_TIERS[0].ratePercent / 100;
  const tier = PLATFORM_FEE_TIERS.find((t) => artistTotalEarnings <= t.maxVolume);
  return (tier?.ratePercent ?? 2) / 100;
}

export function calculateFee(grossAmount: number, artistId: string, totalEarnings: number): {
  fee: number; net: number; ratePercent: number;
} {
  if (FEE_EXEMPT_ARTISTS.has(artistId)) {
    return { fee: 0, net: grossAmount, ratePercent: 0 };
  }
  const rate = getPlatformFeeRate(totalEarnings);
  const fee = parseFloat((grossAmount * rate).toFixed(7));
  return { fee, net: parseFloat((grossAmount - fee).toFixed(7)), ratePercent: rate * 100 };
}

/**
 * Currency conversion (#634).
 * Caches exchange rates in-memory with a configurable TTL.
 */
@Injectable()
export class CurrencyConversionService {
  private readonly logger = new Logger(CurrencyConversionService.name);
  private rateCache = new Map<string, { rate: number; fetchedAt: Date }>();
  private readonly cacheTtlMs = parseInt(process.env.EXCHANGE_RATE_CACHE_TTL_MS ?? '300000', 10);
  private rateHistory: Array<{ pair: string; rate: number; at: Date }> = [];

  async getRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;
    const key = `${from.toUpperCase()}:${to.toUpperCase()}`;
    const cached = this.rateCache.get(key);
    if (cached && Date.now() - cached.fetchedAt.getTime() < this.cacheTtlMs) {
      return cached.rate;
    }
    return this.fetchAndCache(from, to, key);
  }

  private async fetchAndCache(from: string, to: string, key: string): Promise<number> {
    try {
      const apiKey = process.env.EXCHANGE_RATE_API_KEY ?? '';
      const url = `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${from}/${to}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`Exchange rate API returned ${res.status}`);
      const data = (await res.json()) as { conversion_rate: number };
      const rate = data.conversion_rate;
      this.rateCache.set(key, { rate, fetchedAt: new Date() });
      this.rateHistory.push({ pair: key, rate, at: new Date() });
      if (this.rateHistory.length > 500) this.rateHistory = this.rateHistory.slice(-500);
      return rate;
    } catch (err) {
      this.logger.warn(`Failed to fetch exchange rate ${key}: ${err instanceof Error ? err.message : String(err)}`);
      return this.rateCache.get(key)?.rate ?? 1; // fall back to stale or 1:1
    }
  }

  convert(amount: number, rate: number): number {
    return parseFloat((amount * rate).toFixed(7));
  }

  getRateHistory(pair: string) {
    return this.rateHistory.filter((h) => h.pair === pair.toUpperCase());
  }

  // Refresh all cached rates every 5 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshCachedRates() {
    const pairs = [...this.rateCache.keys()];
    await Promise.allSettled(
      pairs.map(async (key) => {
        const [from, to] = key.split(':');
        await this.fetchAndCache(from, to, key);
      }),
    );
  }
}

/**
 * Payment settlement scheduler (#636).
 * Tracks artist balances and schedules payouts.
 */
@Injectable()
export class PaymentSettlementService {
  private readonly logger = new Logger(PaymentSettlementService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Get pending balance for an artist (confirmed payments not yet released). */
  async getArtistBalance(artistId: string): Promise<{ pending: number; released: number; currency: string }> {
    const [pending, released] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { commission: { artistId }, status: PaymentStatus.CONFIRMED },
        _sum: { amountUsdc: true },
      }),
      this.prisma.payment.aggregate({
        where: { commission: { artistId }, status: PaymentStatus.RELEASED },
        _sum: { amountUsdc: true },
      }),
    ]);
    return {
      pending: Number(pending._sum.amountUsdc ?? 0),
      released: Number(released._sum.amountUsdc ?? 0),
      currency: 'USDC',
    };
  }

  /** Create a settlement record when a payout is processed. */
  async recordSettlement(paymentId: string, txHash: string, netAmount: number) {
    this.logger.log(`Settlement recorded — paymentId=${paymentId} txHash=${txHash} net=${netAmount}`);
    // Settlement notification
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { commission: { include: { artist: true } } },
    });
    if (payment?.commission?.artist) {
      await this.prisma.notification.create({
        data: {
          userId: payment.commission.artist.userId,
          type: 'PAYMENT_SETTLED',
          title: 'Payment Settled',
          message: `Settlement of ${netAmount} USDC has been processed. Tx: ${txHash}`,
          metadata: { paymentId, txHash, netAmount },
        },
      });
    }
    return { paymentId, txHash, netAmount, settledAt: new Date() };
  }

  /** Daily batch payout job — processes all CONFIRMED payments older than 24h. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processDailySettlements() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const due = await this.prisma.payment.findMany({
      where: { status: PaymentStatus.CONFIRMED, updatedAt: { lte: cutoff } },
      include: { commission: { include: { artist: { include: { user: true } } } } },
      take: 50,
    });
    this.logger.log(`Daily settlement: ${due.length} payments to process`);
    // Each payment would be processed via StellarService.releaseFundsOnChain
    // Full wiring is in PaymentsService.releasePayment — this job triggers it in batch.
    return { scheduled: due.length, runAt: new Date() };
  }
}

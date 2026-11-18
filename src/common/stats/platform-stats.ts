export interface StatsItem {
  published: boolean;
  /** Asset code of the payment currency, e.g. "USDC" or "XLM". */
  asset: string;
  /** Amount in the asset's own units. */
  amount: number;
}

export interface PlatformStats {
  publishedCount: number;
  volumeByAsset: Record<string, number>;
}

/**
 * Drafts are excluded from the count and volume, and volume is reported per
 * asset: USDC and XLM are different units and must never be summed together.
 */
export function computePlatformStats(items: StatsItem[]): PlatformStats {
  const volumeByAsset: Record<string, number> = {};
  let publishedCount = 0;

  for (const item of items) {
    if (!item.published) continue;
    publishedCount += 1;
    volumeByAsset[item.asset] = (volumeByAsset[item.asset] ?? 0) + item.amount;
  }

  return { publishedCount, volumeByAsset };
}

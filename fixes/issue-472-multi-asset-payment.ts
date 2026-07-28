// Fix for #472: validate that a payment's asset is one of the
// supported codes before building the transaction, and attach it to
// the stored payment record.
export const SUPPORTED_ASSETS = ['XLM', 'USDC', 'NGNT', 'EURC'] as const;
export type SupportedAsset = (typeof SUPPORTED_ASSETS)[number];

export interface PaymentInitiationDto {
  amount: number;
  assetCode: string;
  assetIssuer?: string;
}

export function validateAsset(dto: PaymentInitiationDto): SupportedAsset {
  if (!SUPPORTED_ASSETS.includes(dto.assetCode as SupportedAsset)) {
    throw new Error(`Unsupported asset code: ${dto.assetCode}`);
  }
  if (dto.assetCode !== 'XLM' && !dto.assetIssuer) {
    throw new Error(`assetIssuer is required for ${dto.assetCode}`);
  }
  return dto.assetCode as SupportedAsset;
}

export function toStoredPayment(dto: PaymentInitiationDto) {
  const assetCode = validateAsset(dto);
  return { amount: dto.amount, assetCode, assetIssuer: dto.assetIssuer ?? null };
}

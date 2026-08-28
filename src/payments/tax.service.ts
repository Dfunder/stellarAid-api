import { Injectable, Logger } from '@nestjs/common';

export interface TaxRule { region: string; ratePercent: number; description: string; }

const DEFAULT_TAX_RULES: TaxRule[] = [
  { region: 'default', ratePercent: 0, description: 'No tax (default)' },
  { region: 'EU', ratePercent: 20, description: 'EU VAT' },
  { region: 'UK', ratePercent: 20, description: 'UK VAT' },
  { region: 'NG', ratePercent: 7.5, description: 'Nigeria VAT' },
];

@Injectable()
export class TaxService {
  private readonly rules = new Map(DEFAULT_TAX_RULES.map((r) => [r.region, r]));

  getRate(region: string): TaxRule {
    return this.rules.get(region) ?? this.rules.get('default')!;
  }

  calculateTax(grossAmount: number, region: string) {
    const rule = this.getRate(region);
    const taxAmount = parseFloat((grossAmount * (rule.ratePercent / 100)).toFixed(7));
    return { subtotal: grossAmount, taxRate: rule.ratePercent, taxAmount,
      total: parseFloat((grossAmount + taxAmount).toFixed(7)), region, description: rule.description };
  }

  generateTaxReport(payments: Array<{ amount: number; region: string }>) {
    const byRegion: Record<string, { count: number; totalTax: number; totalGross: number }> = {};
    for (const p of payments) {
      const { taxAmount } = this.calculateTax(p.amount, p.region);
      if (!byRegion[p.region]) byRegion[p.region] = { count: 0, totalTax: 0, totalGross: 0 };
      byRegion[p.region].count++;
      byRegion[p.region].totalTax += taxAmount;
      byRegion[p.region].totalGross += p.amount;
    }
    return { byRegion, generatedAt: new Date() };
  }
}

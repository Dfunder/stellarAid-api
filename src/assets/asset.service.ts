import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssetService {
  constructor(private readonly prisma: PrismaService) {}

  async getAssets() {
    return this.prisma.asset.findMany();
  }

  async getExchangeRate(fromAsset: string, toAsset: string) {
    return this.prisma.exchangeRate.findFirst({
      where: { fromAsset, toAsset },
      orderBy: { createdAt: 'desc' },
    });
  }
}

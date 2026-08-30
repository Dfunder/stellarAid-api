import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AssetService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(
    private readonly prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.bucketName = this.configService.get('AWS_BUCKET_NAME');
  }

  async getAssets() {
    return this.prisma.asset.findMany();
  }

  async getExchangeRate(fromAsset: string, toAsset: string) {
    return this.prisma.exchangeRate.findFirst({
      where: { fromAsset, toAsset },
      orderBy: { createdAt: 'desc' },
    });
  }

  async generatePresignedUrl(
    filename: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; key: string }> {
    const key = `uploads/${uuidv4()}/${filename}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 900, // 15 minutes
    });

    return { uploadUrl, key };
  }
}

import { Body, Controller, Get, Post } from '@nestjs/common';
import { AssetService } from './asset.service';
import { GeneratePresignedUrlDto } from './dto/generate-presigned-url.dto';

@Controller('assets')
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Get()
  async getAssets() {
    return this.assetService.getAssets();
  }

  @Post('generate-presigned-url')
  async generatePresignedUrl(
    @Body() generatePresignedUrlDto: GeneratePresignedUrlDto,
  ) {
    return this.assetService.generatePresignedUrl(
      generatePresignedUrlDto.filename,
      generatePresignedUrlDto.contentType,
    );
  }
}

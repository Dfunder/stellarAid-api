import { Controller, Get } from '@nestjs/common';
import { AssetService } from './asset.service';

@Controller('assets')
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Get()
  async getAssets() {
    return this.assetService.getAssets();
  }
}

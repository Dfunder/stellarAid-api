import { Body, Controller, Get, Injectable, Module, NotImplementedException, Param, Post } from '@nestjs/common';

/** DTO skeleton; add validation decorators when the feature is built. */
export class CreateCampaignDto {
  title!: string;
  description!: string;
  goalAmount!: string;
}

@Injectable()
export class CampaignsService {
  // Placeholder methods: explicit "not implemented" until persistence lands.
  create(_dto: CreateCampaignDto): never {
    throw new NotImplementedException('Campaign creation is not implemented yet');
  }

  findAll(): never {
    throw new NotImplementedException('Campaign listing is not implemented yet');
  }

  findOne(_id: string): never {
    throw new NotImplementedException('Campaign lookup is not implemented yet');
  }
}

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Post()
  create(@Body() dto: CreateCampaignDto) {
    return this.campaigns.create(dto);
  }

  @Get()
  findAll() {
    return this.campaigns.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaigns.findOne(id);
  }
}

@Module({
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}

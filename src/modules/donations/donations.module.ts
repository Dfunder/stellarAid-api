import { Body, Controller, Get, Injectable, Module, NotImplementedException, Post } from '@nestjs/common';

/** Typed DTO placeholder for a future on-chain donation. */
export class CreateDonationDto {
  campaignId!: string;
  amount!: string;
  assetCode?: string;
}

@Injectable()
export class DonationsService {
  create(_dto: CreateDonationDto): never {
    throw new NotImplementedException('Donation tracking is not implemented yet');
  }

  findAll(): never {
    throw new NotImplementedException('Donation listing is not implemented yet');
  }
}

@Controller('donations')
export class DonationsController {
  constructor(private readonly donations: DonationsService) {}

  @Post()
  create(@Body() dto: CreateDonationDto) {
    return this.donations.create(dto);
  }

  @Get()
  findAll() {
    return this.donations.findAll();
  }
}

@Module({
  controllers: [DonationsController],
  providers: [DonationsService],
})
export class DonationsModule {}

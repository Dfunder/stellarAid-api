import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreatePortfolioDto } from './create-portfolio.dto';

export class UpdatePortfolioDto extends PartialType(CreatePortfolioDto) {
  @ApiPropertyOptional({ description: 'Publication visibility state', example: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

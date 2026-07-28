import { IsBoolean, IsNotEmpty } from 'class-validator';

export class VerifyArtistDto {
  @IsNotEmpty()
  @IsBoolean()
  isVerified: boolean;
}
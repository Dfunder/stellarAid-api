import { IsEnum } from 'class-validator';
import { UserStatus } from '../../users/schemas/user.schema';

export class UpdateStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}

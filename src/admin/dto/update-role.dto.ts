import { IsEnum } from 'class-validator';
import { UserRole } from '../../users/schemas/user.schema';

export class UpdateRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}

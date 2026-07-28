import { SetMetadata } from '@nestjs/common';

export const PUBLIC = 'isPublic';
export const Public = () => SetMetadata(PUBLIC, true);

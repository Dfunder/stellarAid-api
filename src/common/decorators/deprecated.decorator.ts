import { SetMetadata } from '@nestjs/common';

export const DEPRECATED_KEY = 'deprecated';

export type DeprecationInfo = {
  sunset: string;
  migration: string;
};

export const Deprecated = (sunset: string, migration: string) =>
  SetMetadata(DEPRECATED_KEY, { sunset, migration });

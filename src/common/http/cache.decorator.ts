import { UseInterceptors } from '@nestjs/common';
import { CacheInterceptor } from './cache.interceptor';

export function Cache(cacheControl: string) {
  return UseInterceptors(new CacheInterceptor(cacheControl));
}

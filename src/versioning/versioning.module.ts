import { Module } from '@nestjs/common';
import { DeprecationInterceptor } from './deprecation.interceptor';
import { VersionController } from './version.controller';

@Module({
  controllers: [VersionController],
  providers: [DeprecationInterceptor],
  exports: [DeprecationInterceptor],
})
export class VersioningModule {}

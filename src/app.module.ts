import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './modules/admin/admin.module';
import { MediaModule } from './modules/media/media.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { InfraModule } from './common/infra/infra.module';
import { VersionController } from './common/http/app-http.extras';

@Module({
  imports: [AdminModule, MediaModule, AnalyticsModule, InfraModule],
  controllers: [AppController, VersionController],
  providers: [AppService],
})
export class AppModule {}

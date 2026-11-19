import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './modules/admin/admin.module';
import { MediaModule } from './modules/media/media.module';

@Module({
  imports: [AdminModule, MediaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

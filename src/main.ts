import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateEnvironment } from './config/environment';

async function bootstrap() {
  const env = validateEnvironment();
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.enableCors({
    origin: env.CORS_ORIGIN.length > 0 ? env.CORS_ORIGIN : false,
    credentials: false,
  });

  app.enableShutdownHooks();

  await app.listen(env.PORT);
}

bootstrap().catch((err) => {
  console.error('Failed to start application', err);
  process.exit(1);
});

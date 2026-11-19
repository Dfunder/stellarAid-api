import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

function resolvePort(portEnv: string | undefined): number {
  if (portEnv === undefined || portEnv === '') {
    return 3000;
  }

  const port = Number(portEnv);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid PORT environment variable: "${portEnv}". Expected an integer between 1 and 65535.`,
    );
  }

  return port;
}

async function bootstrap() {
  const startedAt = Date.now();
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: allowedOrigins?.length ? allowedOrigins : true,
  });
  configureApp(app);
  await app.listen(resolvePort(process.env.PORT));
  if (process.env.STARTUP_TIMING === 'true') {
    console.log(`Startup ready in ${Date.now() - startedAt}ms`);
  }
}

bootstrap().catch((err) => {
  console.error('Failed to start application', err);
  process.exit(1);
});

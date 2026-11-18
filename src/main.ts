import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BodyParserExceptionFilter } from './common/filters/body-parser-exception.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

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

function configureApp(app: INestApplication): INestApplication {
  return app;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new HttpExceptionFilter());
  const allowedOrigins = process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: allowedOrigins?.length ? allowedOrigins : true,
  });
  app.setGlobalPrefix('api/v1');
  await app.listen(resolvePort(process.env.PORT));
}

bootstrap().catch((err) => {
  console.error('Failed to start application', err);
  process.exit(1);
});

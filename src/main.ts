import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

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
  const app = configureApp(await NestFactory.create(AppModule));
  await app.listen(resolvePort(process.env.PORT));
}

bootstrap().catch((err) => {
  console.error('Failed to start application', err);
  process.exit(1);
});

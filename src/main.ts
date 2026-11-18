import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BodyParserExceptionFilter } from './common/filters/body-parser-exception.filter';

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
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new BodyParserExceptionFilter());
  await app.listen(resolvePort(process.env.PORT));
}

bootstrap().catch((err) => {
  console.error('Failed to start application', err);
  process.exit(1);
});

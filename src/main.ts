import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const DEFAULT_PORT = 3000;
const MIN_PORT = 1;
const MAX_PORT = 65535;

export function parsePort(raw: string | undefined): number {
  const value = raw?.trim();

  if (value === undefined || value === '') {
    return DEFAULT_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    throw new Error(
      `Invalid PORT "${raw}": expected an integer between ${MIN_PORT} and ${MAX_PORT}`,
    );
  }

  return port;
}

export async function bootstrap() {
  const port = parsePort(process.env.PORT);
  const app = await NestFactory.create(AppModule);
  await app.listen(port);
}

if (require.main === module) {
  void bootstrap();
}

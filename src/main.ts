import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import helmet from 'helmet';
import { format, transports } from 'winston';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { createValidationPipe } from './common/validation/validation.pipe';
import {
  getRequestId,
  requestIdMiddleware,
} from './common/request-context/request-context';

/**
 * Winston format that stamps every log entry emitted while a request is
 * being handled with that request's id, so logs correlate end-to-end.
 */
const withRequestId = format((info) => {
  const requestId = getRequestId();
  if (requestId) {
    info.requestId = requestId;
  }
  return info;
})();

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const logger = WinstonModule.createLogger({
    level: isProduction ? 'info' : 'debug',
    format: isProduction
      ? format.combine(withRequestId, format.timestamp(), format.json())
      : format.combine(withRequestId, format.timestamp(), format.simple()),
    transports: [
      new transports.Console(),
    ],
  });
  const app = await NestFactory.create(AppModule, { logger });

  // Enable URI versioning with default version 1
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Assign/propagate a unique request id (X-Request-Id) for every request.
  app.use(requestIdMiddleware);

  // Set secure HTTP response headers (CSP, HSTS, X-Frame-Options, etc.).
  app.use(helmet());

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    createValidationPipe(),
  );

  const config = new DocumentBuilder()
    .setTitle('Lumora API')
    .setDescription('Lumora Creative Marketplace API - Version 1')
    .setVersion('1.0')
    .addTag('versioning', 'API uses URI versioning. All endpoints are prefixed with /v1/')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.enableCors({
    origin: process.env.NEXT_PUBLIC_FRONTEND_URL,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'If-None-Match'],
    exposedHeaders: ['ETag', 'X-Request-Id'],
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();

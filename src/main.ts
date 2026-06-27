import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { PiiLoggerService } from './common/logger/pii-logger.service';
import { requestContextMiddleware } from './common/logger/request-context';

async function bootstrap() {
  const logger = new PiiLoggerService();
  const app = await NestFactory.create(AppModule, { logger });
  app.useLogger(logger);
  app.use(requestContextMiddleware);

  // Security headers — issue #323
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );

  // Body size limits — issue #325
  app.use(json({ limit: process.env.JSON_BODY_LIMIT ?? '1mb' }));
  app.use(urlencoded({ extended: true, limit: process.env.FILE_UPLOAD_LIMIT ?? '5mb' }));

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86400, // Preflight caching (24 hours)
  });

  const config = new DocumentBuilder()
    .setTitle('StellarAid API')
    .setDescription('API for StellarAid application')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/api/docs', app, document);

  if (process.env.NODE_ENV !== 'production') {
    const { createBullBoard } = await import('@bull-board/api');
    const { BullAdapter } = await import('@bull-board/api/bullAdapter');
    const { ExpressAdapter } = await import('@bull-board/express');
    const Queue = (await import('bull')).default;

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [
        new BullAdapter(new Queue('email')),
        new BullAdapter(new Queue('contract-events')),
        new BullAdapter(new Queue('analytics')),
        new BullAdapter(new Queue('export')),
      ],
      serverAdapter,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const expressApp = app.getHttpAdapter().getInstance();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    expressApp.use('/admin/queues', serverAdapter.getRouter());
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();

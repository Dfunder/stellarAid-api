import { INestApplication, HttpStatus, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

export function configureApp(app: INestApplication): INestApplication {
  app.use((request: Request, response: Response, next: NextFunction) => {
    const path = request.path ?? request.url;
    if (!path.startsWith('/api/v1') || path.startsWith('/api/v1/docs')) {
      next();
      return;
    }

    response.setHeader('Content-Type', 'application/json; charset=utf-8');

    const accept = request.headers.accept;
    if (
      accept &&
      !accept.split(',').some((entry) => {
        const mediaType = entry.split(';', 1)[0].trim().toLowerCase();
        return (
          mediaType === '*/*' ||
          mediaType === 'application/json' ||
          mediaType.endsWith('+json')
        );
      })
    ) {
      response.status(HttpStatus.NOT_ACCEPTABLE).json({
        statusCode: HttpStatus.NOT_ACCEPTABLE,
        code: 'NOT_ACCEPTABLE',
        message:
          'Requested representation is not available. Use application/json.',
        path: request.url,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const contentLength = request.headers['content-length'];
      if (contentLength !== '0' && contentLength !== undefined) {
        const contentType = (request.headers['content-type'] ?? '')
          .split(';', 1)[0]
          .trim()
          .toLowerCase();
        if (
          contentType !== 'application/json' &&
          !contentType.endsWith('+json')
        ) {
          response.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).json({
            statusCode: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message:
              'Unsupported Content-Type. Request bodies must use application/json.',
            path: request.url,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }
    }

    next();
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api/v1');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('StellarAid API')
    .setDescription('StellarAid backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, { useGlobalPrefix: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  return app;
}

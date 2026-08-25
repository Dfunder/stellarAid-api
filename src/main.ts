import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import helmet from 'helmet';
import { format, transports } from 'winston';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const logger = WinstonModule.createLogger({
    level: isProduction ? 'info' : 'debug',
    format: isProduction
      ? format.combine(format.timestamp(), format.json())
      : format.combine(format.timestamp(), format.simple()),
    transports: [
      new transports.Console({
        stream: process.stdout,
      }),
    ],
  });
  const app = await NestFactory.create(AppModule, { logger });

  // Set secure HTTP response headers (CSP, HSTS, X-Frame-Options, etc.).
  app.use(helmet());

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Lumora API')
    .setDescription('Lumora Creative Marketplace API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.enableCors({
    origin: process.env.NEXT_PUBLIC_FRONTEND_URL,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

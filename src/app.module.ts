import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import * as Joi from 'joi';
import { AuthModule } from './auth/auth.module';
import { JwtAuthModule } from './auth/jwt-auth.module';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';
import { KycModule } from './kyc/kyc.module';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        PORT: Joi.number().default(3000),
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        MONGO_URI: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        JWT_EXPIRES_IN: Joi.string().default('15m'),
        EMAIL_HOST: Joi.string().required(),
        EMAIL_PORT: Joi.number().default(587),
        EMAIL_USER: Joi.string().required(),
        EMAIL_PASS: Joi.string().required(),
        STELLAR_HORIZON_URL: Joi.string().uri().required(),
        STELLAR_NETWORK: Joi.string().valid('testnet', 'mainnet').default('testnet'),
        ALLOWED_ORIGINS: Joi.string().default(''),
      }),
      validationOptions: {
        abortEarly: false,
      },
    }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
        connectionFactory: (connection) => {
          connection.on('connected', () => {
            console.log('MongoDB connected successfully');
          });
          connection.on('error', (err: Error) => {
            console.error('MongoDB connection error:', err.message);
            process.exit(1);
          });
          connection.on('disconnected', () => {
            console.warn('MongoDB disconnected');
          });
          return connection;
        },
      }),
      inject: [ConfigService],
    }),

    AuthModule,
    JwtAuthModule,
    AdminModule,
    ProjectsModule,

    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 15 * 60 * 1000,
        limit: 100,
      },
    ]),

    HealthModule,

    KycModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

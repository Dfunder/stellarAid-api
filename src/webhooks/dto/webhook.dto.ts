import { IsArray, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class RegisterWebhookDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  events?: string[];
}

export class PublishWebhookEventDto {
  @IsString()
  @MaxLength(100)
  type!: string;

  @IsOptional()
  payload?: Record<string, unknown>;
}

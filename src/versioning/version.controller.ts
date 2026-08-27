import { Controller, Get, UseInterceptors, Version } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { DeprecatedApi } from './deprecation.decorator';
import { DeprecationInterceptor } from './deprecation.interceptor';

const V1_SUNSET = 'Thu, 31 Dec 2026 23:59:59 GMT';

/**
 * Demonstrates the platform's URI versioning strategy (#614): the same
 * `GET /version` resource is served by both v1 (deprecated) and v2 (current)
 * handlers, resolved via the `/v1/` and `/v2/` URL prefixes.
 */
@ApiTags('versioning')
@Controller({ path: 'version' })
@UseInterceptors(DeprecationInterceptor)
export class VersionController {
  @Get()
  @Version('1')
  @Public()
  @DeprecatedApi({
    sunset: V1_SUNSET,
    message: 'API v1 is deprecated; migrate to /v2/.',
  })
  @ApiOperation({ summary: 'v1 version info (deprecated)' })
  getV1() {
    return {
      version: '1',
      status: 'deprecated',
      sunset: V1_SUNSET,
      successor: '2',
    };
  }

  @Get()
  @Version('2')
  @Public()
  @ApiOperation({ summary: 'v2 version info (current)' })
  getV2() {
    return {
      version: '2',
      status: 'current',
      changes: ['Standardised pagination metadata', 'Multi-field sorting'],
    };
  }

  @Get('supported')
  @Version('1')
  @Public()
  @ApiOperation({ summary: 'Supported versions and deprecation plan' })
  supported() {
    return {
      strategy: 'URI versioning (prefix /v{n}/)',
      current: '2',
      supported: ['1', '2'],
      deprecated: [{ version: '1', sunset: V1_SUNSET, successor: '2' }],
      backwardCompatibility:
        'v1 remains available until its sunset date; new fields are additive in v2.',
    };
  }
}

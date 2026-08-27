import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { VersionController } from './version.controller';
import { DeprecationInterceptor } from './deprecation.interceptor';
import { DEPRECATED_API } from './deprecation.decorator';

describe('VersionController', () => {
  let controller: VersionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VersionController],
    }).compile();
    controller = module.get<VersionController>(VersionController);
  });

  it('reports v1 as deprecated with a successor', () => {
    expect(controller.getV1()).toMatchObject({
      version: '1',
      status: 'deprecated',
      successor: '2',
    });
  });

  it('reports v2 as current', () => {
    expect(controller.getV2().status).toBe('current');
  });

  it('lists supported and deprecated versions', () => {
    const res = controller.supported();
    expect(res.supported).toEqual(['1', '2']);
    expect(res.deprecated[0].version).toBe('1');
  });
});

describe('DeprecationInterceptor', () => {
  const makeContext = (headers: Record<string, string>) => {
    const res = {
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
    };
    return {
      switchToHttp: () => ({ getResponse: () => res }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };
  const next: CallHandler = { handle: () => of(null) };

  it('sets Deprecation and Sunset headers for deprecated routes', (done) => {
    const reflector = {
      getAllAndOverride: () => ({
        sunset: 'Thu, 31 Dec 2026 23:59:59 GMT',
        message: 'migrate',
      }),
    } as unknown as Reflector;
    const interceptor = new DeprecationInterceptor(reflector);
    const headers: Record<string, string> = {};
    interceptor.intercept(makeContext(headers), next).subscribe(() => {
      expect(headers['Deprecation']).toBe('true');
      expect(headers['Sunset']).toBe('Thu, 31 Dec 2026 23:59:59 GMT');
      done();
    });
  });

  it('sets no headers for non-deprecated routes', (done) => {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;
    const interceptor = new DeprecationInterceptor(reflector);
    const headers: Record<string, string> = {};
    interceptor.intercept(makeContext(headers), next).subscribe(() => {
      expect(Object.keys(headers)).toHaveLength(0);
      expect(DEPRECATED_API).toBe('deprecated_api');
      done();
    });
  });
});

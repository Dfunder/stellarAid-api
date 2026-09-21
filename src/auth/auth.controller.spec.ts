import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Role } from '@prisma/client';
import { Reflector } from '@nestjs/core';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should delegate to AuthService.register with provided DTO', async () => {
      const registerDto = {
        name: 'Elena Rostova',
        email: 'artist@lumora.io',
        password: 'SecurePassword123!',
        role: Role.ARTIST,
      };
      const expectedResponse = { message: 'Verification email sent' };
      mockAuthService.register.mockResolvedValue(expectedResponse);

      const result = await controller.register(registerDto);

      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('login', () => {
    it('should delegate to AuthService.login with credentials', async () => {
      const loginDto = {
        email: 'artist@lumora.io',
        password: 'SecurePassword123!',
      };
      const expectedResponse = { accessToken: 'jwt.token.here' };
      mockAuthService.login.mockResolvedValue(expectedResponse);

      const result = await controller.login(loginDto);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('session', () => {
    it('should return the active user JWT payload', () => {
      const userPayload = {
        sub: 'user-123',
        email: 'artist@lumora.io',
        role: 'ARTIST',
        iat: 1708800000,
        exp: 1708800900,
      };

      const result = controller.session(userPayload);

      expect(result).toEqual({ user: userPayload });
    });
  });
});

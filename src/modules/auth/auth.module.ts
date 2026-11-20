import { Body, Controller, Injectable, Module, NotImplementedException, Post } from '@nestjs/common';

/** Placeholder DTOs. TODO: wallet signature / email verification flows (see README roadmap). */
export class RegisterDto {
  email!: string;
}

export class WalletLoginDto {
  publicKey!: string;
  signature!: string;
}

@Injectable()
export class AuthService {
  // No partial auth is implemented on purpose: nothing here grants access.
  register(_dto: RegisterDto): never {
    throw new NotImplementedException('Registration is not implemented yet');
  }

  walletLogin(_dto: WalletLoginDto): never {
    throw new NotImplementedException('Wallet login is not implemented yet');
  }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('wallet-login')
  walletLogin(@Body() dto: WalletLoginDto) {
    return this.auth.walletLogin(dto);
  }
}

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isValidStellarPublicKey } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectWalletDto } from './dto';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async connectWallet(userId: string, dto: ConnectWalletDto) {
    // Validate Stellar public key format
    if (!isValidStellarPublicKey(dto.publicKey)) {
      throw new BadRequestException(
        'Invalid Stellar public key format. Must start with G and be a valid ed25519 public key.',
      );
    }

    const publicKey = dto.publicKey;

    // Verify the user exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update the user's wallet address
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { walletAddress: publicKey },
      select: { id: true, walletAddress: true, updatedAt: true },
    });

    return {
      message: 'Wallet connected successfully',
      walletAddress: updatedUser.walletAddress,
    };
  }
}

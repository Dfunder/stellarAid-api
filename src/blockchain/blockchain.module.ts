import { Injectable, Module, NotImplementedException } from '@nestjs/common';

/** Typed config placeholders. No secrets: env vars STELLAR_NETWORK, HORIZON_URL, SOROBAN_RPC_URL. */
export interface BlockchainConfig {
  network: 'testnet' | 'public';
  horizonUrl: string;
  sorobanRpcUrl: string;
}

export function loadBlockchainConfig(env: NodeJS.ProcessEnv = process.env): BlockchainConfig {
  const network = env.STELLAR_NETWORK === 'public' ? 'public' : 'testnet';
  return {
    network,
    horizonUrl: env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org',
  };
}

@Injectable()
export class BlockchainService {
  readonly config = loadBlockchainConfig();

  getAccount(_publicKey: string): never {
    throw new NotImplementedException('Horizon account lookup is not implemented yet');
  }

  invokeContract(_contractId: string, _method: string): never {
    throw new NotImplementedException('Soroban invocation is not implemented yet');
  }
}

@Module({
  providers: [BlockchainService],
  exports: [BlockchainService],
})
export class BlockchainModule {}

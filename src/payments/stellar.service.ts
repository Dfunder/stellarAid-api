import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Horizon, rpc } from '@stellar/stellar-sdk';

@Injectable()
export class StellarService implements OnModuleInit {
  private readonly logger = new Logger(StellarService.name);
  private server: Horizon.Server;
  private sorobanServer: rpc.Server;
  private networkPassphrase: string;
  private platformKeypair: StellarSdk.Keypair;
  private escrowContractId: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const network = this.configService.get<string>(
      'STELLAR_NETWORK',
      'TESTNET',
    );

    if (network === 'PUBLIC') {
      this.server = new Horizon.Server('https://horizon.stellar.org');
      this.sorobanServer = new rpc.Server(
        'https://soroban-futurenet.stellar.org',
      );
      this.networkPassphrase = StellarSdk.Networks.PUBLIC;
    } else {
      this.server = new Horizon.Server('https://horizon-testnet.stellar.org');
      this.sorobanServer = new rpc.Server(
        'https://soroban-testnet.stellar.org',
      );
      this.networkPassphrase = StellarSdk.Networks.TESTNET;
    }

    const secret = this.configService.get<string>(
      'PLATFORM_WALLET_SECRET',
      '',
    );
    if (secret) {
      this.platformKeypair = StellarSdk.Keypair.fromSecret(secret);
    }

    this.escrowContractId = this.configService.get<string>(
      'ESCROW_CONTRACT_ID',
      '',
    );

    this.logger.log(
      `Stellar service initialised on ${network} (escrow contract: ${this.escrowContractId || 'not set'})`,
    );
  }

  getNetworkPassphrase(): string {
    return this.networkPassphrase;
  }

  getPlatformPublicKey(): string {
    return this.platformKeypair?.publicKey() ?? '';
  }

  getEscrowContractId(): string {
    return this.escrowContractId;
  }

  async loadAccount(publicKey: string): Promise<Horizon.AccountResponse> {
    return this.server.loadAccount(publicKey);
  }

  /**
   * Build an unsigned Soroban transaction that calls the Escrow contract's
   * `create_escrow` function. Returns the XDR for the client to sign with
   * their Freighter wallet.
   */
  async buildEscrowCreationTx(
    clientPublicKey: string,
    artistPublicKey: string,
    amount: string,
    assetCode: string,
    commissionId: string,
  ): Promise<string> {
    const contract = new StellarSdk.Contract(this.escrowContractId);
    const sourceAccount = await this.loadAccount(clientPublicKey);

    const clientAddr = this.addressToScVal(clientPublicKey);
    const artistAddr = this.addressToScVal(artistPublicKey);
    const amountScVal = this.i128ToScVal(BigInt(Math.round(parseFloat(amount) * 10_000_000)));
    const assetScVal = StellarSdk.xdr.ScVal.scvBytes(
      Buffer.from(assetCode),
    );
    const commissionScVal = StellarSdk.xdr.ScVal.scvBytes(
      Buffer.from(commissionId),
    );

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'create_escrow',
          clientAddr,
          artistAddr,
          amountScVal,
          assetScVal,
          commissionScVal,
        ),
      )
      .setTimeout(300)
      .build();

    return transaction.toXDR();
  }

  /**
   * Build and sign a Soroban transaction that calls the Escrow contract's
   * `release_payment` function, splitting funds between artist and platform.
   * Returns the transaction hash after submission.
   */
  async releaseFundsOnChain(
    artistWallet: string,
    grossAmount: number,
    platformFee: number,
    assetCode: string,
    commissionId: string,
  ): Promise<{ txHash: string }> {
    const contract = new StellarSdk.Contract(this.escrowContractId);
    const sourceAccount = await this.loadAccount(
      this.platformKeypair.publicKey(),
    );

    const artistAddr = this.addressToScVal(artistWallet);
    const platformAddr = this.addressToScVal(
      this.platformKeypair.publicKey(),
    );
    const grossScVal = this.i128ToScVal(
      BigInt(Math.round(grossAmount * 10_000_000)),
    );
    const feeScVal = this.i128ToScVal(
      BigInt(Math.round(platformFee * 10_000_000)),
    );
    const assetScVal = StellarSdk.xdr.ScVal.scvBytes(
      Buffer.from(assetCode),
    );
    const commissionScVal = StellarSdk.xdr.ScVal.scvBytes(
      Buffer.from(commissionId),
    );

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'release_payment',
          artistAddr,
          platformAddr,
          grossScVal,
          feeScVal,
          assetScVal,
          commissionScVal,
        ),
      )
      .setTimeout(300)
      .build();

    transaction.sign(this.platformKeypair);

    const result = await this.server.submitTransaction(transaction);
    return { txHash: result.hash };
  }

  /**
   * Build an unsigned payment / create-escrow transaction and return its XDR.
   * The client signs the XDR with their Freighter wallet before submitting.
   */
  async buildEscrowTransaction(
    sourcePublicKey: string,
    destinationPublicKey: string,
    amount: string,
    assetCode: string,
    assetIssuer?: string,
    memo?: string,
  ): Promise<string> {
    const sourceAccount = await this.loadAccount(sourcePublicKey);

    const asset =
      assetCode === 'XLM'
        ? StellarSdk.Asset.native()
        : new StellarSdk.Asset(assetCode, assetIssuer!);

    const txBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: destinationPublicKey,
          asset,
          amount,
        }),
      )
      .setTimeout(180);

    if (memo) {
      txBuilder.addMemo(StellarSdk.Memo.text(memo));
    }

    const transaction = txBuilder.build();
    return transaction.toXDR();
  }

  /**
   * Submit a signed XDR transaction to the Stellar network.
   * Returns the transaction hash on success.
   */
  async submitTransaction(
    signedXdr: string,
  ): Promise<{ txHash: string; successful: boolean }> {
    const transaction = StellarSdk.TransactionBuilder.fromXDR(
      signedXdr,
      this.networkPassphrase,
    );

    const result = await this.server.submitTransaction(
      transaction as StellarSdk.Transaction,
    );

    return {
      txHash: result.hash,
      successful: result.successful ?? true,
    };
  }

  /**
   * Release a payment from the platform wallet to the artist's wallet,
   * deducting the platform fee.
   */
  async releaseFunds(
    artistWallet: string,
    grossAmount: number,
    platformFee: number,
    assetCode: string,
    assetIssuer?: string,
  ): Promise<{ txHash: string }> {
    const netAmount = (grossAmount - platformFee).toFixed(7);

    const sourceAccount = await this.loadAccount(
      this.platformKeypair.publicKey(),
    );

    const asset =
      assetCode === 'XLM'
        ? StellarSdk.Asset.native()
        : new StellarSdk.Asset(assetCode, assetIssuer!);

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: artistWallet,
          asset,
          amount: netAmount,
        }),
      )
      .setTimeout(180)
      .build();

    transaction.sign(this.platformKeypair);

    const result = await this.server.submitTransaction(transaction);
    return { txHash: result.hash };
  }

  private addressToScVal(address: string): StellarSdk.xdr.ScVal {
    const rawKey = StellarSdk.StrKey.decodeEd25519PublicKey(address);
    return StellarSdk.xdr.ScVal.scvAddress(
      StellarSdk.xdr.ScAddress.scAddressTypeAccount(
        StellarSdk.xdr.PublicKey.publicKeyTypeEd25519(rawKey),
      ),
    );
  }

  /**
   * Build and sign a Soroban transaction that calls the Escrow contract's
   * `refund_payment` function, sending funds back to the client.
   * Returns the transaction hash after submission.
   */
  async refundFundsOnChain(
    clientWallet: string,
    grossAmount: number,
    assetCode: string,
    commissionId: string,
  ): Promise<{ txHash: string }> {
    const contract = new StellarSdk.Contract(this.escrowContractId);
    const sourceAccount = await this.loadAccount(
      this.platformKeypair.publicKey(),
    );

    const clientAddr = this.addressToScVal(clientWallet);
    const grossScVal = this.i128ToScVal(
      BigInt(Math.round(grossAmount * 10_000_000)),
    );
    const assetScVal = StellarSdk.xdr.ScVal.scvBytes(
      Buffer.from(assetCode),
    );
    const commissionScVal = StellarSdk.xdr.ScVal.scvBytes(
      Buffer.from(commissionId),
    );

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'refund_payment',
          clientAddr,
          grossScVal,
          assetScVal,
          commissionScVal,
        ),
      )
      .setTimeout(300)
      .build();

    transaction.sign(this.platformKeypair);

    const result = await this.server.submitTransaction(transaction);
    return { txHash: result.hash };
  }

  /**
   * Build and sign a Soroban transaction that calls the Escrow contract's
   * `partial_release_payment` function, splitting funds between artist, platform, and client.
   * Returns the transaction hash after submission.
   */
  async partialReleaseFundsOnChain(
    artistWallet: string,
    clientWallet: string,
    grossAmount: number,
    artistShareBps: number,
    platformFee: number,
    assetCode: string,
    commissionId: string,
  ): Promise<{ txHash: string }> {
    const contract = new StellarSdk.Contract(this.escrowContractId);
    const sourceAccount = await this.loadAccount(
      this.platformKeypair.publicKey(),
    );

    const artistAddr = this.addressToScVal(artistWallet);
    const clientAddr = this.addressToScVal(clientWallet);
    const platformAddr = this.addressToScVal(
      this.platformKeypair.publicKey(),
    );
    const grossScVal = this.i128ToScVal(
      BigInt(Math.round(grossAmount * 10_000_000)),
    );
    const artistShareScVal = this.i128ToScVal(BigInt(artistShareBps));
    const feeScVal = this.i128ToScVal(
      BigInt(Math.round(platformFee * 10_000_000)),
    );
    const assetScVal = StellarSdk.xdr.ScVal.scvBytes(
      Buffer.from(assetCode),
    );
    const commissionScVal = StellarSdk.xdr.ScVal.scvBytes(
      Buffer.from(commissionId),
    );

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'partial_release_payment',
          artistAddr,
          clientAddr,
          platformAddr,
          grossScVal,
          artistShareScVal,
          feeScVal,
          assetScVal,
          commissionScVal,
        ),
      )
      .setTimeout(300)
      .build();

    transaction.sign(this.platformKeypair);

    const result = await this.server.submitTransaction(transaction);
    return { txHash: result.hash };
  }

  private i128ToScVal(value: bigint): StellarSdk.xdr.ScVal {
    const hi = new StellarSdk.xdr.Hyper(BigInt.asIntN(64, value >> BigInt(64)));
    const lo = new StellarSdk.xdr.UnsignedHyper(BigInt.asUintN(64, value));
    return StellarSdk.xdr.ScVal.scvI128(
      new StellarSdk.xdr.Int128Parts({ hi, lo }),
    );
  }
}
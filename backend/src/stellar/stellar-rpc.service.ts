import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  formatStellarAssetId,
  isValidStellarPublicKey,
  lteRawAmount,
  stellarAmountToRawAmount,
} from './stellar.util';

type HorizonTransaction = {
  id: string;
  hash: string;
  successful: boolean;
};

type HorizonOperation = {
  type: string;
  to?: string;
  asset_code?: string;
  asset_issuer?: string;
  amount?: string;
};

@Injectable()
export class StellarRpcService {
  private readonly horizonUrl: string;
  private readonly usdcDecimals: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    const network = this.configService.get<string>('STELLAR_NETWORK') === 'PUBLIC' ? 'PUBLIC' : 'TESTNET';
    this.horizonUrl =
      this.configService.get<string>('STELLAR_HORIZON_URL') ??
      (network === 'PUBLIC' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org');
    this.usdcDecimals = Number(this.configService.get<string>('STELLAR_USDC_DECIMALS') ?? '7');
  }

  getAssetId(assetCode?: string, issuer?: string): string {
    const code = assetCode ?? this.configService.get<string>('STELLAR_USDC_ASSET_CODE') ?? 'USDC';
    const assetIssuer = issuer ?? this.configService.get<string>('STELLAR_USDC_ASSET_ISSUER');
    if (!assetIssuer) {
      throw new Error('STELLAR_USDC_ASSET_ISSUER_NOT_CONFIGURED');
    }
    return formatStellarAssetId(code, assetIssuer);
  }

  isValidAddress(address: string): boolean {
    return isValidStellarPublicKey(address);
  }

  private async horizonGet<T>(path: string): Promise<T> {
    const url = `${this.horizonUrl.replace(/\/+$/, '')}${path}`;
    const response = await firstValueFrom(this.httpService.get<T>(url));
    return response.data;
  }

  async getTransaction(txHash: string): Promise<HorizonTransaction | null> {
    try {
      return await this.horizonGet<HorizonTransaction>(`/transactions/${encodeURIComponent(txHash)}`);
    } catch {
      return null;
    }
  }

  async getTransactionOperations(txHash: string): Promise<HorizonOperation[]> {
    const data = await this.horizonGet<{ _embedded?: { records?: HorizonOperation[] } }>(
      `/transactions/${encodeURIComponent(txHash)}/operations?limit=200`,
    );
    return data._embedded?.records ?? [];
  }

  async verifyTransfer(
    txHash: string,
    expectedRecipient: string,
    expectedAssetId: string,
    minAmountRaw: string,
  ): Promise<{ success: boolean; message?: string; actualAmount?: string }> {
    if (!/^[0-9]+$/.test(minAmountRaw)) {
      return { success: false, message: 'INVALID_MIN_AMOUNT_RAW' };
    }

    if (!isValidStellarPublicKey(expectedRecipient)) {
      return { success: false, message: 'INVALID_RECIPIENT_ADDRESS' };
    }

    const [expectedAssetCode, expectedIssuer] = expectedAssetId.split(':');
    if (!expectedAssetCode || !isValidStellarPublicKey(expectedIssuer ?? '')) {
      return { success: false, message: 'INVALID_STELLAR_ASSET_ID' };
    }

    const tx = await this.getTransaction(txHash);
    if (!tx) {
      return { success: false, message: 'Transaction not found' };
    }

    if (!tx.successful) {
      return { success: false, message: 'Transaction failed' };
    }

    const ops = await this.getTransactionOperations(txHash);
    let received = '0';

    for (const op of ops) {
      if (op.type !== 'payment') continue;
      if (op.to !== expectedRecipient) continue;
      if (op.asset_code !== expectedAssetCode) continue;
      if (op.asset_issuer !== expectedIssuer) continue;
      if (!op.amount) continue;

      const raw = stellarAmountToRawAmount(op.amount, this.usdcDecimals);
      received = (BigInt(received) + BigInt(raw)).toString();
    }

    if (received === '0') {
      return { success: false, message: 'NO_MATCHING_ASSET_PAYMENT_FOUND' };
    }

    if (!lteRawAmount(minAmountRaw, received)) {
      return { success: false, message: 'RECEIVED_AMOUNT_TOO_LOW', actualAmount: received };
    }

    return { success: true, actualAmount: received };
  }
}

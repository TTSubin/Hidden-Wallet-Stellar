import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { isValidStellarPublicKey } from '../../stellar/stellar.util';

type HorizonBalance = {
  balance: string;
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
};

@Injectable()
export class StellarService {
  private readonly horizonUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {
    const network = this.config.get<string>('STELLAR_NETWORK') === 'PUBLIC' ? 'PUBLIC' : 'TESTNET';
    this.horizonUrl =
      this.config.get<string>('STELLAR_HORIZON_URL') ??
      (network === 'PUBLIC' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org');
  }

  async getBalance(address: string): Promise<string> {
    if (!isValidStellarPublicKey(address)) {
      throw new Error('Invalid Stellar address format');
    }

    const url = `${this.horizonUrl.replace(/\/+$/, '')}/accounts/${encodeURIComponent(address)}`;
    const response = await firstValueFrom(this.http.get<{ balances: HorizonBalance[] }>(url));
    const native = response.data.balances.find((b) => b.asset_type === 'native');
    return native?.balance ?? '0';
  }

  async validateAddress(address: string): Promise<boolean> {
    return isValidStellarPublicKey(address);
  }
}

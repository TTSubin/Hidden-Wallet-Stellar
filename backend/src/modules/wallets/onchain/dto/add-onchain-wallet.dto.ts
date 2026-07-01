import { IsString, IsOptional } from 'class-validator';

export class AddOnchainWalletDto {
  @IsString()
  address: string;

  @IsString()
  chain: string; // "Stellar", "Ethereum", "Bitcoin", etc.

  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  walletProvider?: string; // "freighter", "metamask", "phantom", etc.

  @IsString()
  @IsOptional()
  publicKey?: string;
}

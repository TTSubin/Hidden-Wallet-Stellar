import { StrKey } from '@stellar/stellar-sdk';

export type StellarNetwork = 'TESTNET' | 'PUBLIC';

export function isValidStellarPublicKey(address: string): boolean {
  return typeof address === 'string' && StrKey.isValidEd25519PublicKey(address.trim());
}

export function formatStellarAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-5)}`;
}

export function stroopsToXlm(stroops: string): number {
  const value = Number(stroops);
  return Number.isFinite(value) ? value / 10_000_000 : 0;
}

export function getStellarExplorerTxUrl(hash: string, network: StellarNetwork): string {
  const segment = network === 'TESTNET' ? 'testnet' : 'public';
  return `https://stellar.expert/explorer/${segment}/tx/${hash}`;
}

export function getStellarNetworkPassphrase(network: StellarNetwork): string {
  return network === 'TESTNET'
    ? 'Test SDF Network ; September 2015'
    : 'Public Global Stellar Network ; September 2015';
}

export function getConfiguredStellarNetwork(): StellarNetwork {
  return import.meta.env.VITE_STELLAR_NETWORK === 'PUBLIC' ? 'PUBLIC' : 'TESTNET';
}

export function getTransactionFeedbackMessage(args: { success: boolean; hash?: string }): string {
  if (!args.success) return 'Transaction failed. Please try again.';
  return args.hash ? `Transaction submitted: ${args.hash}` : 'Transaction submitted successfully.';
}

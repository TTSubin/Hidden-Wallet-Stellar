import { StrKey } from '@stellar/stellar-sdk';

export function isValidStellarPublicKey(address: string): boolean {
  return typeof address === 'string' && StrKey.isValidEd25519PublicKey(address.trim());
}

export function formatStellarAssetId(assetCode: string, issuer: string): string {
  return `${assetCode}:${issuer}`;
}

export function stellarAmountToRawAmount(amount: string, decimals: number): string {
  if (!/^[0-9]+(\.[0-9]+)?$/.test(amount)) {
    throw new Error('INVALID_STELLAR_AMOUNT');
  }

  const [whole, fraction = ''] = amount.split('.');
  if (fraction.length > decimals) {
    throw new Error('STELLAR_AMOUNT_TOO_MANY_DECIMALS');
  }

  const padded = fraction.padEnd(decimals, '0');
  return (BigInt(whole) * BigInt(10 ** decimals) + BigInt(padded || '0')).toString();
}

export function rawAmountToStellarAmount(raw: string, decimals: number): string {
  if (!/^[0-9]+$/.test(raw)) {
    throw new Error('INVALID_RAW_AMOUNT');
  }

  const base = BigInt(10 ** decimals);
  const value = BigInt(raw);
  const whole = value / base;
  const fraction = (value % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function lteRawAmount(a: string, b: string): boolean {
  if (!/^[0-9]+$/.test(a) || !/^[0-9]+$/.test(b)) {
    return false;
  }

  if (a.length !== b.length) return a.length < b.length;
  return a <= b;
}

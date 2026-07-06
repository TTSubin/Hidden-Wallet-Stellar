import { describe, expect, it } from 'vitest';
import { getAuthUserWalletAddress, isWalletSessionMismatch } from './authWalletSession';

describe('AuthContext wallet session helpers', () => {
  it('reads the authenticated wallet address from supported profile shapes', () => {
    expect(getAuthUserWalletAddress({ walletAddress: ' GABC ' })).toBe('GABC');
    expect(getAuthUserWalletAddress({ address: 'GDEF' })).toBe('GDEF');
    expect(getAuthUserWalletAddress(null)).toBeNull();
  });

  it('detects when the active extension wallet differs from the authenticated profile wallet', () => {
    expect(isWalletSessionMismatch('GACTIVE', { walletAddress: 'GSESSION' })).toBe(true);
    expect(isWalletSessionMismatch('gactive', { walletAddress: 'GACTIVE' })).toBe(false);
    expect(isWalletSessionMismatch(null, { walletAddress: 'GSESSION' })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { isDifferentWalletAddress, shouldApplyWalletFetchResult } from './walletGuards';

describe('WalletContext wallet guards', () => {
  it('treats wallet addresses case-insensitively', () => {
    expect(isDifferentWalletAddress('GACTIVE', 'gactive')).toBe(false);
    expect(isDifferentWalletAddress('GACTIVE', 'GOTHER')).toBe(true);
  });

  it('does not report a mismatch when one side is missing', () => {
    expect(isDifferentWalletAddress(null, 'GACTIVE')).toBe(false);
    expect(isDifferentWalletAddress('GACTIVE', null)).toBe(false);
  });

  it('only applies balance/history results from the latest request for the same target wallet', () => {
    expect(shouldApplyWalletFetchResult({
      requestId: 2,
      latestRequestId: 2,
      requestTargetAddress: 'GACTIVE',
      currentTargetAddress: 'gactive',
    })).toBe(true);

    expect(shouldApplyWalletFetchResult({
      requestId: 1,
      latestRequestId: 2,
      requestTargetAddress: 'GOLD',
      currentTargetAddress: 'GACTIVE',
    })).toBe(false);

    expect(shouldApplyWalletFetchResult({
      requestId: 2,
      latestRequestId: 2,
      requestTargetAddress: 'GOLD',
      currentTargetAddress: 'GACTIVE',
    })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { isDifferentWalletAddress } from './walletGuards';

describe('WalletContext wallet guards', () => {
  it('treats wallet addresses case-insensitively', () => {
    expect(isDifferentWalletAddress('GACTIVE', 'gactive')).toBe(false);
    expect(isDifferentWalletAddress('GACTIVE', 'GOTHER')).toBe(true);
  });

  it('does not report a mismatch when one side is missing', () => {
    expect(isDifferentWalletAddress(null, 'GACTIVE')).toBe(false);
    expect(isDifferentWalletAddress('GACTIVE', null)).toBe(false);
  });
});

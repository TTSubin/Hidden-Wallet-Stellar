import {
  formatStellarAddress,
  getStellarExplorerTxUrl,
  isValidStellarPublicKey,
  stroopsToXlm,
} from './stellar';

const validAddress = 'GDGDMHUAXQWP45T6B24NS57C2NL4BBXPGIBELRDZIGTSBEEA77EJVYFO';

test('validates Stellar public keys', () => {
  expect(isValidStellarPublicKey(validAddress)).toBe(true);
  expect(isValidStellarPublicKey('not-a-stellar-address')).toBe(false);
});

test('formats Stellar balances and explorer links', () => {
  expect(formatStellarAddress(validAddress)).toBe('GDGDMH...JVYFO');
  expect(stroopsToXlm('25000000')).toBe(2.5);
  expect(getStellarExplorerTxUrl('abc123', 'TESTNET')).toContain('/testnet/tx/abc123');
});

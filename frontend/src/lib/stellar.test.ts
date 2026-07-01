import {
  formatStellarAddress,
  getStellarExplorerTxUrl,
  getTransactionFeedbackMessage,
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

test('formats transaction feedback with optional hash', () => {
  expect(getTransactionFeedbackMessage({ success: true, hash: 'abc123' })).toBe('Transaction submitted: abc123');
  expect(getTransactionFeedbackMessage({ success: false })).toBe('Transaction failed. Please try again.');
});

import { describe, expect, test } from 'vitest';
import { formatTransactionAmount } from './transactions';

describe('formatTransactionAmount', () => {
  test('formats whole USDC amounts without trailing decimals', () => {
    expect(formatTransactionAmount({ amount: 10, token: 'USDC', type: 'received' })).toBe('+$10');
  });

  test('keeps meaningful USDC cents', () => {
    expect(formatTransactionAmount({ amount: 2.5, token: 'USDC', type: 'sent' })).toBe('-$2.50');
  });

  test('formats XLM amounts with token symbol', () => {
    expect(formatTransactionAmount({ amount: 500, token: 'XLM', type: 'sent' })).toBe('-500 XLM');
  });
});

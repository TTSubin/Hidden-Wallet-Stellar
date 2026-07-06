type TransactionAmountInput = {
  amount: number;
  token: 'XLM' | 'USDC';
  type: 'sent' | 'received';
};

export function formatTransactionAmount(tx: TransactionAmountInput) {
  const sign = tx.type === 'sent' ? '-' : '+';

  if (tx.token === 'XLM') {
    return `${sign}${tx.amount.toLocaleString(undefined, { maximumFractionDigits: 7 })} XLM`;
  }

  return `${sign}$${tx.amount.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(tx.amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

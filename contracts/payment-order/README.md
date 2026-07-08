# Payment Order Soroban Contract

This MVP is not an escrow contract.

It is a payment order processor and on-chain transaction registry for Hidden Wallet. Tokens are transferred directly from the payer to the recipient in the same transaction that pays the order. The contract does not hold funds for admin release, recipient claim, or later refund.

## Flow

1. A payer creates a payment order, or creates and pays it in one call.
2. The contract validates the order data and payer authorization.
3. The contract calls the Soroban token contract to transfer the exact token amount directly from payer to recipient.
4. The order is stored as `Created`, `Paid`, or `Cancelled`.
5. Events are emitted so a backend/indexer can build admin transaction history later.

## Public Functions

- `initialize(admin)`
- `create_order(order_id, payer, recipient, token, amount, deadline)`
- `pay_order(order_id)`
- `create_and_pay_order(order_id, payer, recipient, token, amount, deadline)`
- `cancel_order(order_id)`
- `get_order(order_id)`

`order_id` is represented as `BytesN<32>` so backend systems can hash or encode their own order identifiers before passing them on-chain.

## Out of Scope

- Gaian payout VND
- bank transfer
- crypto-to-fiat settlement
- admin release
- treasury settlement
- recipient claim
- refund from contract
- frontend integration
- backend integration
- admin dashboard UI
- production indexer

## Tests

Run from this directory:

```bash
cargo test
```

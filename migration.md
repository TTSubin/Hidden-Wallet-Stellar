# SUI to Stellar Migration Summary

This file lists the migration work completed to replace the Sui runtime with Stellar and Freighter.

## Backend

- Replaced Sui packages with Stellar:
  - Removed `@mysten/sui` and `@mysten/sui.js`.
  - Added `@stellar/stellar-sdk`.
- Added Stellar blockchain modules and helpers:
  - `backend/src/stellar/stellar.module.ts`
  - `backend/src/stellar/stellar-rpc.service.ts`
  - `backend/src/stellar/stellar.util.ts`
  - `backend/src/integrations/blockchain/stellar.service.ts`
- Replaced Sui RPC payment verification with Stellar Horizon verification:
  - Loads transaction by Stellar transaction hash.
  - Checks transaction success.
  - Checks payment operation destination, asset code, issuer, and amount.
- Updated payment config from Sui env vars to Stellar env vars:
  - `STELLAR_NETWORK`
  - `STELLAR_HORIZON_URL`
  - `STELLAR_USDC_ASSET_CODE`
  - `STELLAR_USDC_ASSET_ISSUER`
  - `STELLAR_USDC_DECIMALS`
  - `PARTNER_STELLAR_ADDRESS`
- Updated auth to verify Stellar/Freighter message signatures.
- Kept `/auth/challenge` and `/auth/verify` API shape for minimal frontend churn.
- Removed Sui/zkLogin/prover runtime files and wiring.
- Updated wallet and QR scanning logic to treat Stellar `G...` addresses as on-chain wallets.
- Updated Swagger/API copy from Sui to Stellar.
- Updated backend README and Docker Compose naming from Sui payment to Stellar payment.

## Frontend

- Replaced Sui wallet packages with Stellar/Freighter:
  - Removed `@mysten/dapp-kit` and `@mysten/sui`.
  - Added `@stellar/stellar-sdk` and `@stellar/freighter-api`.
- Replaced `SuiProvider` with `StellarProvider`.
- Rebuilt `WalletContext` around Freighter:
  - Connect/disconnect wallet.
  - Read connected Stellar address.
  - Sign auth messages.
  - Load XLM and USDC balances from Horizon.
  - Build, sign, and submit Stellar USDC payment transactions.
- Updated `AuthContext` to sign login challenges with Freighter.
- Updated pages to use Stellar wallet state:
  - Login
  - Dashboard
  - Send
  - Settings
  - History
  - Onboarding
- Replaced Sui address validation (`0x...`) with Stellar public key validation (`G...`).
- Replaced SUI gas checks with XLM network-fee balance checks.
- Replaced Sui explorer links with StellarExpert transaction links.
- Removed Sui WalletConnect/Slush wallet hook.
- Updated UI copy, metadata, README text, and wallet labels from Sui to Stellar/Freighter.
- Removed old `frontend/public/token-icons/sui.svg`.

## Schema and Docs

- Removed unused `ZkLoginSalt` Prisma model from `backend/prisma/schema.prisma`.
- Replaced `file_sui.md` with `file_stellar.md`.
- Added Stellar migration inventory in `file_stellar.md`.

## Verification Run

- Backend build:
  - `npm run build` passed.
- Backend helper test:
  - `npx ts-node src/stellar/stellar.util.spec.ts` passed.
- Frontend tests:
  - `npm run test` passed.
  - 2 test files, 3 tests passed.
- Frontend build:
  - `npm run build` passed.
  - Remaining warning: bundle chunk size is larger than 500 kB.
- Frontend lint:
  - `npm run lint` exited successfully.
  - Remaining warnings are non-blocking Fast Refresh/hook dependency warnings.
- Old runtime search:
  - No matches for `@mysten`, `dapp-kit`, `suiscan`, `slush`, `zklogin`, `PARTNER_SUI`, or `SUI_`.

## Notes

- Existing order DB fields such as `coinType` and `userPaymentTxDigest` were preserved for compatibility.
- `coinType` now stores Stellar asset identifiers like `USDC:<issuer>`.
- `userPaymentTxDigest` is still used as the API field name, but it now represents a Stellar transaction hash.
- The workspace did not have a valid Git repository, so no branch, worktree, or commit was created.

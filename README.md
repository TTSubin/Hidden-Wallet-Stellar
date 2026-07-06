# HiddenWallet Hybrid Payment Platform

## Project Description

HiddenWallet is a hybrid payment platform that bridges decentralized finance on Stellar and traditional fiat payment systems. It is designed for seamless cross-border payments: a user pays with cryptocurrency, such as Stellar USDC, and the recipient receives fiat currency, such as VND or PHP, in their bank account.

The system manages the full payment order lifecycle, from quote generation to final settlement. It integrates with external services for real-time exchange rates and payment execution, while the backend handles user authentication, profile management, linked wallets, linked bank accounts, referrals, commissions, and order verification.

This repository includes the Stellar testnet challenge implementation. The current demo connects Freighter, displays XLM and USDC balances, submits testnet transactions, shows the transaction result to the user, and provides a transaction detail view with a Stellar Explorer link.

## Key Features

- Hybrid payment processing: manages orders that convert Stellar USDC payments into fiat bank payouts.
- Stellar wallet authentication: authenticates users with Freighter by signing a Stellar wallet challenge.
- Freighter wallet connection: connects and disconnects Stellar testnet accounts through Freighter.
- User and wallet management: manages user profiles, on-chain Stellar wallets, and off-chain bank accounts.
- Username payments: lets users claim a unique `@username` for easier transfers.
- Send XLM: sends native XLM on Stellar testnet.
- Send USDC: sends Stellar USDC when the recipient has the configured issuer trustline.
- QR payments: scans VietQR codes through the camera for faster checkout.
- Bank linking: links bank accounts by scanning payment QR codes.
- Dynamic quoting: provides crypto-to-fiat quotes with platform fees.
- External service integration: connects with the Gaian API for exchange rates and payment execution.
- Referral and commission system: rewards users for referred transaction activity.
- Database management: uses Prisma ORM with PostgreSQL.
- API documentation: exposes interactive Swagger/OpenAPI documentation.
- Testnet transaction proof: sends XLM and USDC on testnet, then shows success and transaction details to the user.

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Wallet: Freighter via `@stellar/freighter-api`
- Blockchain: Stellar SDK and Horizon via `@stellar/stellar-sdk`
- Backend: NestJS, Prisma, PostgreSQL
- API docs: Swagger
- Docker: PostgreSQL, backend, frontend

## Prerequisites

- Node.js 22 or newer
- npm
- Docker Desktop and Docker Compose, if running with Docker
- PostgreSQL, if running the backend directly on your machine
- Freighter browser extension
- A funded Stellar testnet account

For testnet XLM, fund your account with Stellar Laboratory Friendbot or another Stellar testnet faucet. In Freighter, make sure the selected network is `Testnet`.

## Environment Variables

### Backend

Create `backend/.env` from `backend/.env.example`.

```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hiddenwallet_testnet?schema=public

JWT_SECRET=dev_secret_change_me
JWT_EXPIRES_IN=7d
AUTH_DOMAIN=http://localhost:5173
AUTH_CHALLENGE_TTL_SECONDS=300

STELLAR_NETWORK=TESTNET
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_USDC_ASSET_CODE=USDC
STELLAR_USDC_ASSET_ISSUER=<testnet-usdc-issuer-public-key>
STELLAR_USDC_DECIMALS=7
PARTNER_STELLAR_ADDRESS=<partner-stellar-public-key>

GAIAN_PAYMENT_BASE_URL=https://dev-payments.gaian-dev.network
GAIAN_USER_BASE_URL=https://user.gaian-dev.network
GAIAN_QR_BASE_URL=https://payments.gaian-dev.network
GAIAN_API_KEY=<optional-gaian-api-key>
GAIAN_QR_API_KEY=<optional-gaian-qr-api-key>
```

`PARTNER_STELLAR_ADDRESS` is the merchant/partner Stellar address that receives USDC for off-ramp orders. The backend uses it when verifying that a user paid the correct destination.

### Frontend

Create `frontend/.env` from `frontend/.env.example`.

```env
VITE_API_URL=http://localhost:3000/api
VITE_STELLAR_NETWORK=TESTNET
VITE_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
VITE_STELLAR_USDC_ASSET_CODE=USDC
VITE_STELLAR_USDC_ASSET_ISSUER=<testnet-usdc-issuer-public-key>
VITE_STELLAR_USDC_DECIMALS=7
```

Important: `STELLAR_USDC_ASSET_ISSUER` and `VITE_STELLAR_USDC_ASSET_ISSUER` define which USDC asset this app uses. The recipient must still add a USDC trustline for that exact issuer in Freighter, and the recipient account needs enough testnet XLM to create the trustline.

## Setup Instructions

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

Backend:

- API base URL: `http://localhost:3000/api`
- Swagger docs: `http://localhost:3000/api`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend:

- App URL: `http://localhost:5173`

## Run With Docker

Create the Docker env file:

```bash
cp .env.docker.example .env
```

Fill these values in `.env` before using USDC or off-ramp flows:

```env
STELLAR_USDC_ASSET_ISSUER=<testnet-usdc-issuer-public-key>
PARTNER_STELLAR_ADDRESS=<partner-stellar-public-key>
GAIAN_PAYMENT_BASE_URL=https://dev-payments.gaian-dev.network
GAIAN_USER_BASE_URL=https://user.gaian-dev.network
GAIAN_QR_BASE_URL=https://payments.gaian-dev.network
```

Start the full stack:

```bash
docker compose up -d --build
```

Open:

- Frontend: `http://localhost:5173`
- Backend / Swagger: `http://localhost:3000/api`
- PostgreSQL: `localhost:5432`

Useful Docker commands:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose down
```

The Docker backend syncs the Prisma schema on startup with `prisma db push`.

## Transaction Flow

### XLM Testnet Flow

Use this flow to prove a native Stellar testnet payment from one Freighter account to another.

1. Fund the sender account with testnet XLM from Stellar Laboratory Friendbot or another testnet faucet.
2. Fund the recipient account with enough testnet XLM to exist on Stellar testnet.
3. Open `http://localhost:5173`.
4. Connect Freighter.
5. Select the sender account in Freighter and make sure the Freighter network is `Testnet`.
6. Go to `Send`.
7. Choose `XLM Testnet`.
8. Enter a recipient Stellar public key that starts with `G`.
9. Enter the XLM amount.
10. Review the network fee and destination.
11. Confirm the transaction in Freighter.
12. The app submits a native Stellar payment through Horizon.
13. The app shows `Transaction success` with a `Click here to see` explorer link.
14. Open the explorer link and verify the transaction on Stellar testnet.
15. Open transaction history in the app and verify the row displays a native amount such as `-2 XLM`.

### USDC Testnet Flow

Use this flow to prove a Stellar issued-asset payment on testnet. The app uses the USDC issuer configured in the backend and frontend env files.

1. Configure the same USDC issuer in both env files:
   - Backend: `STELLAR_USDC_ASSET_ISSUER`
   - Frontend: `VITE_STELLAR_USDC_ASSET_ISSUER`
2. Make sure the sender account has testnet XLM for fees.
3. Add the configured USDC trustline to the sender account.
4. Mint or receive the configured testnet USDC asset into the sender account.
5. Make sure the recipient account exists on Stellar testnet and has enough XLM to hold trustlines.
6. Add the same configured USDC trustline to the recipient account.
7. Open `http://localhost:5173`.
8. Connect Freighter.
9. Select the sender account in Freighter and make sure the Freighter network is `Testnet`.
10. Go to `Send`.
11. Choose `USDC`.
12. Enter the recipient Stellar public key that starts with `G`.
13. Enter the USDC amount.
14. Review the network fee, issuer-backed USDC asset, and destination.
15. Confirm the transaction in Freighter.
16. The app submits a Stellar credit asset payment through Horizon.
17. The app shows `Transaction success` with a `Click here to see` explorer link.
18. Open the explorer link and verify the transaction asset is `USDC` from the configured issuer.
19. Open transaction history in the app and verify the row keeps the dollar-style USDC amount display.

If the recipient has not added the trustline, the app shows: `Recipient has not added a USDC trustline for this Stellar issuer`.

### Transaction History

- XLM payments show native amounts, for example `-2 XLM`.
- USDC payments keep the existing dollar-style amount display.
- Long addresses are shortened in the list to the first 6 and last 6 characters.
- Click any history row to open the transaction detail view.

## Screenshots

The required challenge screenshots are stored in `docs/screenshots/`.

### Wallet Connected State

![Wallet connected state](docs/screenshots/wallet-connected.png)

### Balance Displayed

![Balance displayed](docs/screenshots/balance-displayed.png)

### Successful Testnet Transaction

USDC testnet transaction detail:

![Successful USDC testnet transaction](docs/screenshots/usdc-transaction-detail.png)

XLM testnet transaction detail:

![Successful XLM testnet transaction](docs/screenshots/xlm-transaction-detail.png)

### Transaction Result Shown To The User

USDC result shown after submission:

![USDC transaction result shown to the user](docs/screenshots/usdc-transaction-result.png)

XLM result shown after submission:

![XLM transaction result shown to the user](docs/screenshots/xlm-transaction-result.png)

## Verification Commands

Frontend:

```bash
cd frontend
npm run test
npm run lint
npm run build
```

Backend:

```bash
cd backend
npm run build
```

## Troubleshooting

- `INVALID_SIGNATURE`: clear the app session/local storage, reconnect Freighter, make sure Freighter is signing for the same account shown in the app, then sign in again.
- `Recipient has not added a USDC trustline`: add the configured USDC issuer as a trustline in the recipient Freighter account.
- `Gaian registerUser failed: Route ... not found`: use `GAIAN_USER_BASE_URL=https://user.gaian-dev.network`, not the payment base URL.
- Docker Hub TLS timeout while pulling Nginx: retry the build or run `docker pull nginx:1.27-alpine` after Docker/network is stable.
- Docker API `502 Bad Gateway`: restart or update Docker Desktop, then run `docker compose up -d --build` again.

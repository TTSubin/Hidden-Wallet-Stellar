# HiddenWallet Stellar Challenge

HiddenWallet is a Stellar-based payment wallet that connects to Freighter, displays Stellar balances, and lets users send testnet XLM or Stellar USDC. The app also keeps the existing off-ramp flow shape for crypto-to-fiat payments while using Stellar addresses and Horizon-backed transaction handling.

## Features

- Connect a Stellar wallet with Freighter.
- Authenticate with Stellar wallet message signing.
- Display XLM and USDC balances from Stellar Horizon.
- Send XLM transactions on Stellar testnet.
- Show transaction success or failure feedback to the user.
- Display the submitted transaction hash after a successful testnet transaction.
- Support USDC payment and off-ramp order confirmation flows.

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Wallet: Freighter (`@stellar/freighter-api`)
- Blockchain: Stellar SDK and Horizon (`@stellar/stellar-sdk`)
- Backend: NestJS, Prisma, PostgreSQL
- API docs: Swagger

## Prerequisites

- Node.js 22 or newer
- npm
- PostgreSQL for backend features
- Docker and Docker Compose for containerized local runs
- Freighter browser extension
- A funded Stellar testnet account

You can fund a testnet account from the Stellar Laboratory Friendbot or another Stellar testnet faucet.

## Setup Instructions

### 1. Clone and Install

```bash
git clone <repository-url>
cd Stellar-challenge
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

Install backend dependencies:

```bash
cd ../backend
npm install
```

### 2. Configure Backend Environment

Create `backend/.env` and fill in the local database, Stellar, JWT, and partner payment settings.

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/hiddenwallet"
JWT_SECRET=replace-with-a-secure-secret
JWT_EXPIRES_IN=1d

STELLAR_NETWORK=TESTNET
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_USDC_ASSET_CODE=USDC
STELLAR_USDC_ASSET_ISSUER=<testnet-usdc-issuer-public-key>
STELLAR_USDC_DECIMALS=7
PARTNER_STELLAR_ADDRESS=<partner-stellar-public-key>

GAIAN_API_KEY=<optional-gaian-api-key>
GAIAN_BASE_URL=<optional-gaian-base-url>
PAYOUT_FEE_PERCENT=2
```

Generate Prisma client and run migrations:

```bash
cd backend
npm run prisma:generate
npx prisma migrate dev
```

Start the backend:

```bash
npm run start:dev
```

The backend runs at `http://localhost:3000` and Swagger docs are available at `http://localhost:3000/api`.

### 3. Configure Frontend Environment

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000
VITE_STELLAR_NETWORK=TESTNET
VITE_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
VITE_STELLAR_USDC_ASSET_CODE=USDC
VITE_STELLAR_USDC_ASSET_ISSUER=<testnet-usdc-issuer-public-key>
VITE_STELLAR_USDC_DECIMALS=7
```

Start the frontend:

```bash
cd frontend
npm run dev
```

Open the Vite local URL, usually `http://localhost:5173`.

## Run with Docker

This repository includes Docker files for a local Stellar testnet stack:

- PostgreSQL testnet database
- NestJS backend API
- React frontend served by Nginx

Create a local Docker env file:

```bash
cp .env.docker.example .env
```

Update `.env` if you need Stellar USDC/off-ramp support:

```env
STELLAR_USDC_ASSET_ISSUER=<testnet-usdc-issuer-public-key>
PARTNER_STELLAR_ADDRESS=<partner-stellar-public-key>
GAIAN_API_KEY=<optional-gaian-api-key>
GAIAN_PAYMENT_BASE_URL=<optional-gaian-payment-url>
```

Start the full stack:

```bash
docker compose up --build
```

Open:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000/api`
- PostgreSQL: `localhost:5432`

The Docker backend uses `STELLAR_NETWORK=TESTNET`, `https://horizon-testnet.stellar.org`, and runs `prisma db push` on startup to sync the local testnet database schema.

## Local Testnet Transaction Flow

1. Open the app locally.
2. Connect Freighter and select Stellar testnet.
3. Make sure the connected account has testnet XLM.
4. Go to Send.
5. Choose `XLM Testnet`.
6. Enter a recipient Stellar public key that starts with `G`.
7. Enter the XLM amount.
8. Confirm and approve the transaction in Freighter.
9. The app shows success or failure feedback.
10. On success, the app displays the Stellar transaction hash.

## Screenshots

Add the challenge screenshots to `docs/screenshots/` using the filenames below.

### Wallet Connected State

![Wallet connected state](docs/screenshots/wallet-connected.png)

### Balance Displayed

![Balance displayed](docs/screenshots/balance-displayed.png)

### Successful Testnet Transaction

![Successful testnet transaction](docs/screenshots/successful-testnet-transaction.png)

### Transaction Result Shown to the User

![Transaction result shown to the user](docs/screenshots/transaction-result.png)

## Useful Commands

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

## Notes

- The XLM transaction flow is intentionally restricted to Stellar testnet.
- Freighter is the primary wallet connector and signer.
- USDC issuer addresses are configured through environment variables instead of being hardcoded.

# HiddenWallet Stellar Challenge

HiddenWallet Stellar Challenge is a Stellar testnet wallet and off-ramp demo. It connects to Freighter, authenticates users with a Stellar wallet signature, displays XLM and USDC balances through Horizon, sends testnet XLM/USDC transactions, and shows transaction feedback plus history/detail views.

The backend keeps the existing order/off-ramp API shape, but Stellar payments are verified with Horizon transaction data.

## Features

- Connect and disconnect Freighter wallet.
- Sign in with a Stellar wallet message.
- Display XLM balance and Stellar USDC trustline balance.
- Send XLM on Stellar testnet.
- Send Stellar USDC when the recipient has the matching USDC trustline.
- Show `Transaction success` with a `Click here to see` explorer link after a successful transaction.
- Show failure messages for common Stellar errors, including missing recipient trustline.
- Show transaction history; XLM rows display amounts like `-2 XLM`, while USDC rows keep the existing dollar-style design.
- Open a transaction detail screen by clicking any history item.
- Confirm off-ramp payment orders with a Stellar transaction hash.

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

## Run Locally

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

### Send XLM On Testnet

1. Open `http://localhost:5173`.
2. Connect Freighter.
3. Select the Stellar testnet account in Freighter.
4. Go to `Send`.
5. Choose `XLM Testnet`.
6. Enter a recipient Stellar public key that starts with `G`.
7. Enter the XLM amount.
8. Confirm in Freighter.
9. The app shows `Transaction success` and a `Click here to see` link to the transaction explorer.

### Send USDC On Testnet

1. Configure the same USDC issuer in backend and frontend env files.
2. Make sure the sender has that USDC asset.
3. Make sure the recipient has a USDC trustline for that exact issuer.
4. Send from the app and approve in Freighter.

If the recipient has not added the trustline, the app shows: `Recipient has not added a USDC trustline for this Stellar issuer`.

### Transaction History

- XLM payments show native amounts, for example `-2 XLM`.
- USDC payments keep the existing dollar-style amount display.
- Long addresses are shortened in the list to the first 6 and last 6 characters.
- Click any history row to open the transaction detail view.

## Screenshots

Add the required challenge screenshots to `docs/screenshots/` with these filenames.

### Wallet Connected State

![Wallet connected state](docs/screenshots/wallet-connected.png)

### Balance Displayed

![Balance displayed](docs/screenshots/balance-displayed.png)

### Successful Testnet Transaction

![Successful testnet transaction](docs/screenshots/successful-testnet-transaction.png)

### Transaction Result Shown To The User

![Transaction result shown to the user](docs/screenshots/transaction-result.png)

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

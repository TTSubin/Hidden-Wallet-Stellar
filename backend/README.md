# Stellar Payment Backend

## 🚀 Project Overview

This project is the backend service for a hybrid payment platform that bridges the gap between decentralized finance (DeFi) on the Stellar blockchain and traditional fiat payment systems. It is designed to facilitate seamless cross-border payments, allowing users to pay with cryptocurrency (like USDC on Stellar) and have the recipient receive fiat currency (like VND) in their bank account.

The system manages the entire lifecycle of a payment order, from quote generation to final settlement. It integrates with external services for real-time exchange rates and payment processing, while handling user authentication, profile management, and a multi-tiered referral and commission structure internally.

Authentication is a key feature, supporting cryptographic signatures from Stellar wallets such as Freighter.

## ✨ Key Features

- **Hybrid Payment Processing**: Manages orders that convert cryptocurrency (USDC) to fiat currency (VND, PHP, etc.) for bank payouts.
- **Wallet Authentication**: Freighter/Stellar message signing with JWT issuance.
- **User & Wallet Management**: Full CRUD for user profiles, on-chain (Stellar) wallets, and off-chain (bank) accounts.
- **Referral & Commission System**: Rewards users for referring others by granting them a commission calculated from the platform fees of their referees' transactions.
- **Dynamic Quoting**: Provides real-time quotes for crypto-to-fiat swaps, including platform fees.
- **External Service Integration**: Connects with the Gaian API for exchange rates and payment execution.
- **Database Management**: Uses Prisma ORM for robust and type-safe database interactions with a PostgreSQL backend.
- **API Documentation**: Auto-generated and interactive API documentation via Swagger (OpenAPI).

## 🛠️ Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Blockchain**: Stellar SDK (`@stellar/stellar-sdk`) and Horizon
- **Authentication**: JWT and Freighter/Stellar message signatures
- **API Docs**: Swagger

## 📦 Prerequisites

- Node.js (v18 or newer)
- pnpm (recommended package manager)
- PostgreSQL (v14 or newer)
- Docker (optional, for local database setup)

## 🔧 Getting Started

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd stellar-payment
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment

Copy the example environment file and fill in the required values. The backend will not start without a valid `.env` file.

```bash
cp .env.example .env
```

**Key variables in `.env`:**

```env
# Database connection string
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"

# JWT configuration
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=1d

# Stellar network and USDC asset
STELLAR_NETWORK=TESTNET
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_USDC_ASSET_CODE=USDC
STELLAR_USDC_ASSET_ISSUER=issuer_public_key
STELLAR_USDC_DECIMALS=7
PARTNER_STELLAR_ADDRESS=partner_public_key

# External APIs
GAIAN_API_KEY=your_gaian_api_key
GAIAN_BASE_URL=https://api.gaian.network

# Business Logic
PAYOUT_FEE_PERCENT=2
```

## 🚦 Running the Application

- **Development Mode** (with hot-reloading):
  ```bash
  pnpm start:dev
  ```

- **Production Mode**:
  ```bash
  pnpm build
  pnpm start:prod
  ```

The server will start on `http://localhost:3000` by default.

## 🗄️ Database

This project uses Prisma for database management.

- **Generate Prisma Client** (after any `schema.prisma` changes):
  ```bash
  npx prisma generate
  ```

- **Create a New Migration**:
  ```bash
  npx prisma migrate dev --name your-migration-name
  ```

- **Apply Migrations to a Database** (e.g., in production):
  ```bash
  npx prisma migrate deploy
  ```

- **Browse Your Database**:
  ```bash
  npx prisma studio
  ```

## 📚 API Documentation

Once the application is running, you can access the interactive Swagger API documentation at:

[http://localhost:3000/api](http://localhost:3000/api)

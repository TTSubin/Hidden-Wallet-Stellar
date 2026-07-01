# HiddenWallet UI - Stellar Blockchain Wallet

A minimalist Stellar Blockchain Wallet WebApp.

## Features

- **Connect Wallet**: Connect using Freighter wallet
- **Username System**: Claim a unique @username for easy payments
- **Send USDC**: Send to HiddenWallet usernames or scan VietQR codes
- **QR Scanner**: Camera-based QR scanning for payments
- **Bank Linking**: Link bank accounts via QR code

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **UI**: Tailwind CSS + Shadcn/UI
- **Blockchain**: Stellar Network via Freighter and @stellar/stellar-sdk

## Getting Started

### Prerequisites

- Node.js 18+
- npm or bun

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
```

## Project Structure

```
src/
├── components/     # Reusable UI components
├── context/        # React context providers
├── hooks/          # Custom React hooks
├── pages/          # Page components
├── providers/      # Stellar wallet providers
└── lib/            # Utility functions
```

## License

MIT

# ClipCash

**Turn your long videos into short viral clips — automatically, with full control, and optional NFT ownership.**

ClipCash helps content creators (YouTubers, podcasters, gamers, coaches…) save many hours of work by turning one long video into dozens or hundreds of short clips ready for TikTok, Instagram Reels, YouTube Shorts, and more.

You always stay in control:
→ Preview every clip
→ Choose which ones you like
→ Delete the bad ones
→ Then post only the good ones automatically

**Bonus: you can also turn your best clips into NFTs on the Stellar network (very cheap & fast) so you truly own them and can earn royalties forever.**

## Features

- **Full preview & selection** — most tools post random clips. ClipCash lets you see and pick only the best ones.
- **Automatic posting** to 7+ platforms (TikTok, Instagram, YouTube Shorts, Facebook Reels, Snapchat Spotlight, Pinterest, LinkedIn)
- **Web2 + Web3 in one app** — normal accounts + optional Stellar NFTs with royalties
- **Simple & beautiful interface** — dark mode, clean design, easy to use
- **AI-powered clip generation** — automatically finds viral moments in your videos
- **Earnings dashboard** — track revenue across all platforms
- **NFT Vault** — mint and manage your video NFTs on Stellar
- **Wallet integration** — connect MetaMask for Web3 features

## Stellar Wallet Integration

- `clips-frontend/components/StellarWalletProvider.tsx` provides app-wide Stellar wallet state.
- Use the exported `useStellarWallet()` hook to read `address`, `isConnected`, `isLoading`, and access the initialized `kit`.
- The provider dynamically initializes `StellarWalletsKit` with default modules such as `injected`, `ledger`, and `walletconnect`.

If you plan to use the Stellar wallet flow, install the matching package and configure it in your app.

```bash
npm install stellar-wallets-kit
```

## Tech Stack

| Part           | Technology                          | Why we chose it                     |
| -------------- | ----------------------------------- | ----------------------------------- |
| Frontend       | Next.js 16 + React 19 + TypeScript  | Fast, beautiful, mobile-friendly    |
| Styling        | Tailwind CSS 4                      | Utility-first, rapid development     |
| State Management | Zustand 5                        | Lightweight, persistent storage     |
| UI Components  | lucide-react                        | Beautiful, consistent icons         |
| Blockchain     | Stellar Soroban (Rust)              | Very cheap fees, built-in royalties |
| AI             | Runway Gen-3 + Claude               | Finds the most viral moments        |

## Getting Started



- **Node.js** version 18 or newer
- **npm** or **yarn** package manager
- **Git**
- A modern browser (Chrome, Firefox, Edge recommended)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/anoncon/clips-frontend.git
cd clips-frontend
```

2. Install dependencies:
```bash

npm install
```

3. Set up environment variables:
```bash
cp .env.example clips-frontend/.env.local
```
Edit `clips-frontend/.env.local` using the template at [.env.example](.env.example). Each variable is documented there with links to where you can obtain credentials.

4. Start the development server:
```bash
npm run dev
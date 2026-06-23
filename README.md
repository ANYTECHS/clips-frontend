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

- `components/StellarWalletProvider.tsx` provides app-wide Stellar wallet state.
- Use the exported `useStellarWallet()` hook to read `address`, `isConnected`, `isLoading`, and access the initialized `kit`.
- The provider dynamically initializes `StellarWalletsKit` with default modules such as `injected`, `ledger`, and `walletconnect`.

If you plan to use the Stellar wallet flow, install the matching package and configure it in your app.

```bash
npm install stellar-wallets-kit
```

## Tech Stack

| Part           | Technology                          | Why we chose it                     |
|----------------|-------------------------------------|-------------------------------------|
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
cp .env.example .env.local
```
Edit `.env.local` using the template at [.env.example](.env.example). Each variable is documented there with links to where you can obtain credentials.

4. Start the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## API Endpoints

### Upload Video
`POST /api/upload`

Uploads video files for AI processing.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `files`: Video file(s) (max 500MB per file)
  - Supported formats: MP4, MOV, AVI, MKV

**Response:**
```json
{
  "success": true,
  "message": "Successfully uploaded 1 file(s)",
  "jobId": "job_1234567890_abc123xyz",
  "files": [
    {
      "name": "video.mp4",
      "size": 104857600,
      "type": "video/mp4"
    }
  ]
}
```

**Error Response:**
```json
{
  "error": "File exceeds maximum size of 500MB"
}
```

### Check Job Status
`GET /api/jobs/:jobId`

Poll this endpoint to get real-time processing status updates.

**Response:**
```json
{
  "progress": 45,
  "status": "processing",
  "momentsFound": 3,
  "estimatedSecondsRemaining": 120
}
```

**Status Values:**
- `processing`: Job is actively being processed
- `complete`: Processing finished successfully
- `error`: Processing failed

## Features

### Real-Time Processing Progress
The `/dashboard/processing` page uses a polling mechanism (every 3 seconds) to fetch real-time job status from the backend via the `useProcessingStatus` hook.

### Push Notifications
When a processing job completes, users receive browser push notifications (if permission granted). Notification preferences are persisted to localStorage.

- Permission request happens on first upload
- Clicking notification navigates to `/projects` page
- Works with service worker for background notifications
- Users can manage preferences in settings

### SEO Optimization
- `app/robots.ts`: Disallows crawling of authenticated routes
- `app/sitemap.ts`: Includes only public marketing pages
- Public routes: `/`, `/login`, `/privacy`, `/terms`, `/status`

## Hybrid Web2 -> Web3 Wallet Architecture

ClipCash employs a sophisticated hybrid Web2 -> Web3 architecture to seamlessly transition users from traditional authentication methods to Web3 paradigms, allowing frictionless onboarding while maintaining decentralization options for power users.

### 1. Seamless Onboarding (Web2 Focus)
- **Authentication**: Users can sign up via traditional OAuth providers (Google, Apple) using `next-auth`.
- **Embedded Wallets**: Upon registration, an invisible "smart wallet" is generated on the backend using multi-party computation (MPC) or smart contract accounts (ERC-4337). This shields users from mnemonic phrases or gas fees.
- **Custody Management**: The backend manages transactions temporarily, signing them on behalf of the user to provide a smooth "Web2-like" experience.

### 2. Transition and Backup (Advanced Mode)
- **Advanced Wallet Mode**: Power users can navigate to Settings > Advanced Wallet Mode to reveal their underlying cryptographic identities.
- **Export Secret Key**: Users can view and export the raw private key associated with their embedded smart wallet to take full self-custody.
- **External Backup Wallet**: To secure assets and ensure redundancy, users can connect an external Web3 wallet (MetaMask or Phantom) via the `WalletProvider.tsx`.
- **State Management**: Wallet states and current active connections are managed securely through browser-level encryption (`secureStorage.ts`) and global context (`WalletProvider.tsx`).

### 3. Integration with Smart Contracts
- **Minting NFTs**: When a user mints their clips into NFTs (Vault), the app determines if they are using an embedded wallet or an external connection.
- **Transaction Flow**: For external wallets, a signature is requested directly via window injections (`window.ethereum` or `window.solana`). For embedded wallets, the server signs and dispatches the payload automatically.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# ClipCash - AI Clipping Platform

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 📚 Component Documentation

**[View Storybook Component Library](http://localhost:6006/)** (when running locally)

Our component library is documented using Storybook, featuring 11+ reusable components with interactive examples, accessibility testing, and auto-generated documentation.

To run Storybook locally:
```bash
npm run storybook
```

See [STORYBOOK.md](./STORYBOOK.md) for detailed documentation.

## Getting Started

First, run the development server:

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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

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

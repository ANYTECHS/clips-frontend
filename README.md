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

### Prerequisites

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
cd clips-frontend
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```
Edit `.env.local` with your configuration (see Environment Variables section below).

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Create a `.env.local` file in the `clips-frontend` directory with the following variables:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000

# Stellar Blockchain
NEXT_PUBLIC_STELLAR_RPC=https://soroban-testnet.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK=testnet

# Optional: Analytics
# NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

See `.env.example` for a complete list of available environment variables.

## Project Structure

```
clips-frontend/
├── app/                          # Next.js app directory (routes)
│   ├── components/               # App-specific components (DashboardHeader)
│   ├── clips/                    # Clips page
│   ├── cookies/                  # Cookie policy page
│   ├── dashboard/                # Dashboard + processing sub-page
│   ├── earnings/                 # Earnings page
│   ├── hooks/                    # Custom hooks (useDashboardData, useProcessStore)
│   ├── lib/                      # Utilities (mockApi, sanitize, secureStorage, rateLimiter)
│   ├── login/                    # Login page
│   ├── forgot-password/          # Password reset request page
│   ├── reset-password/            # Password reset with token page
│   ├── nft-demo/                 # NFT demo page
│   ├── onboarding/               # Onboarding flow
│   ├── platforms/                # Platform connections page
│   ├── privacy/                  # Privacy policy
│   ├── projects/                 # Projects page
│   ├── store/                    # Zustand stores (index, types, dashboard, earnings, process, user)
│   ├── terms/                    # Terms page
│   ├── vault/                    # NFT Vault page
│   ├── layout.tsx                # Root layout with providers
│   └── page.tsx                  # Home page
├── components/                   # Shared components
│   ├── clips/                    # Clip-related (Hero, CreateClipsForm, etc.)
│   ├── dashboard/                # Dashboard components (StatCard, RevenueChart, etc.)
│   ├── navigation/               # Sidebar, PlanUsage
│   ├── platforms/                # Platform cards and banners
│   ├── projects/                 # Project-related (ClipCard, ClipGrid, etc.)
│   ├── ui/                       # Base UI components (ProgressBar, StatusBadge)
│   ├── vault/                    # Vault components (NFTCard, NFTGrid)
│   ├── AuthForm.tsx              # Login/signup form
│   ├── AuthProvider.tsx          # Auth context provider
│   ├── WalletProvider.tsx        # Wallet connection provider
│   └── Navbar.tsx                # Navigation bar
├── hooks/                        # Shared hooks (useToast, useUndoRedo)
├── public/                       # Static assets
│   ├── projects/                 # Project images
│   └── *.svg, avatar.png        # Icons and images
├── package.json
├── tsconfig.json
├── next.config.ts
├── eslint.config.mjs
├── README.md
└── .env.example                  # Environment variables template
```

## Available Scripts

- `npm run dev` — Start development server
- `npm run build` — Build for production
- `npm run start` — Start production server
- `npm run lint` — Run ESLint

## Contributing

We welcome contributions! Please follow these guidelines:

### Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Guidelines

- Follow the existing code style
- Write clear, descriptive commit messages
- Add tests for new features when applicable
- Update documentation as needed
- Ensure `npm run lint` passes before submitting
- Keep PRs focused on a single feature or fix

### Reporting Issues

- Use the GitHub issue tracker
- Include steps to reproduce bugs
- Specify your environment (OS, browser, Node.js version)
- Include relevant screenshots if applicable

## Security

- All sensitive data in localStorage is encrypted using AES-GCM via the Web Crypto API
- Rate limiting is implemented on API calls to prevent abuse
- Password reset tokens expire after 1 hour
- No external dependencies for encryption (uses native Web Crypto API)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Screenshots / Demo

![ClipCash Dashboard](public/screenshots/dashboard.png)
*Dashboard showing earnings overview and clip statistics*

![Clip Creation](public/screenshots/create-clips.png)
*AI-powered clip creation from long videos*

**Demo GIF**: [Add a demo GIF here showing the clip creation flow]

---

Made with ❤️ for content creators everywhere.

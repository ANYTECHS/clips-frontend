This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Clips Frontend - AI-Powered Video Clip Generator

A modern web application for generating AI-powered video clips from long-form content and distributing them across social media platforms.

## Features

- **Video Upload & Processing**: Upload videos or provide URLs for AI-powered clip generation
- **Multi-Platform Distribution**: Generate clips optimized for TikTok, Instagram, and YouTube
- **Real-Time Progress Tracking**: WebSocket-based live updates during clip generation
- **Auto-Publishing**: Optional automatic publishing to connected platforms
- **Process Dashboard**: Monitor clip generation progress with detailed metrics

## Recent Updates

### Form Submission Feature
Complete implementation of the clip generation form with:
- Video input via URL or file upload
- Platform selection (TikTok, Instagram, YouTube)
- Auto-publish toggle
- Real-time validation and error handling
- Loading states and submission prevention

See [FEATURE_SUMMARY.md](./FEATURE_SUMMARY.md) for details.

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Backend API service running (see backend documentation)

### Installation

```bash
# Install dependencies
npm install
```

### Environment Setup

Create a `.env.local` file:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/progress
```

### Run Development Server

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

### Key Routes

- `/` - Landing page
- `/dashboard` - Main dashboard with process tracking
- `/create` - Clip generation form (NEW)
- `/library` - Clip library (coming soon)
- `/billing` - Billing management (coming soon)

## Project Structure

```
clips-frontend/
├── app/
│   ├── create/              # Clip generation form
│   ├── dashboard/           # Main dashboard
│   ├── components/          # Reusable UI components
│   ├── hooks/              # Custom React hooks
│   └── api/                # API route handlers
├── public/                 # Static assets
└── docs/                   # Documentation
```

## Documentation

- [FEATURE_SUMMARY.md](./FEATURE_SUMMARY.md) - Latest feature overview
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Detailed setup instructions
- [FORM_SUBMISSION_IMPLEMENTATION.md](./FORM_SUBMISSION_IMPLEMENTATION.md) - Technical implementation details
- [BENTO_GRID_IMPLEMENTATION.md](./BENTO_GRID_IMPLEMENTATION.md) - Grid layout system
- [RESPONSIVE_DESIGN.md](./RESPONSIVE_DESIGN.md) - Responsive design guidelines

## Development

### Running Tests

```bash
npm run test
```

### Building for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **State Management**: Zustand + Custom Hooks
- **Testing**: Vitest + Testing Library
- **Real-Time**: WebSocket

## Contributing

1. Create a feature branch
2. Make your changes
3. Add tests if applicable
4. Run linting and tests
5. Submit a pull request

## Troubleshooting

See [SETUP_GUIDE.md](./SETUP_GUIDE.md#troubleshooting) for common issues and solutions.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

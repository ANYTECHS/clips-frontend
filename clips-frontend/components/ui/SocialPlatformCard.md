# Social Platform Integration Card

A reusable React component for displaying social media platform integration status with connect/manage functionality.

## Features

- ✅ Support for TikTok, Instagram, YouTube, and X (Twitter)
- ✅ Dynamic status badges (Active vs. Not Linked)
- ✅ Connected username display
- ✅ Connect to sync instructional text
- ✅ Responsive design with hover effects
- ✅ TypeScript support
- ✅ Accessible with proper ARIA labels

## Usage

```tsx
import { SocialPlatformCard } from '@/components/ui';

// Connected account
<SocialPlatformCard
  platform="tiktok"
  isConnected={true}
  username="creator123"
  onManage={() => handleManage()}
/>

// Not connected account
<SocialPlatformCard
  platform="youtube"
  isConnected={false}
  onConnect={() => handleConnect()}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `platform` | `SocialPlatform` | Required | One of: `'tiktok' | 'instagram' | 'youtube' | 'x'` |
| `isConnected` | `boolean` | `false` | Whether the account is connected |
| `username` | `string` | `undefined` | Username for connected accounts |
| `onConnect` | `() => void` | `undefined` | Callback for connect action |
| `onManage` | `() => void` | `undefined` | Callback for manage action |
| `className` | `string` | `''` | Additional CSS classes |

## Design System Integration

The component follows the ClipCash design system:

- **Colors**: Uses brand primary `#17f9bf` for active states and CTAs
- **Typography**: Sans-serif font stack with proper hierarchy
- **Spacing**: Consistent padding and margins
- **Border Radius**: `rounded-2xl` for cards following the design system
- **Transitions**: Smooth hover effects and state changes

## Platform Configuration

Each platform has its own color scheme:

- **TikTok**: `#FE2C55` (red)
- **Instagram**: `#E4405F` (pink/red)  
- **YouTube**: `#FF0000` (red)
- **X**: `#000000` (black)

## Accessibility

- Semantic HTML structure
- Proper ARIA labels on icons
- Keyboard navigation support
- Screen reader friendly status indicators
- High contrast colors for text

## File Structure

```
components/
├── ui/
│   ├── SocialPlatformCard.tsx
│   └── index.ts
├── icons/
│   ├── TikTokIcon.tsx
│   ├── InstagramIcon.tsx
│   ├── YouTubeIcon.tsx
│   ├── XIcon.tsx
│   └── index.ts
└── Icon.tsx
```

## Implementation Notes

- Component uses Tailwind CSS for styling
- Icons are custom SVG components with proper sizing
- Status indicators use CSS animations for visual feedback
- Responsive design works on mobile and desktop
- Follows existing component patterns in the codebase

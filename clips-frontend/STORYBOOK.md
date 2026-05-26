# Storybook Component Documentation

This document provides information about the Storybook setup for ClipCash AI component documentation.

## 📚 Overview

Storybook is an open-source tool for building UI components and pages in isolation. It streamlines UI development, testing, and documentation.

**Live Storybook**: [Coming Soon - Will be deployed to Chromatic/Vercel]

## 🚀 Quick Start

### Running Storybook Locally

```bash
# Install dependencies
npm install

# Start Storybook development server
npm run storybook
```

Storybook will be available at: http://localhost:6006/

### Building Storybook

```bash
# Build static Storybook
npm run build-storybook
```

The static build will be output to `storybook-static/` directory.

## 📦 Components Documented

We have created stories for 11+ core components:

### Dashboard Components
1. **StatCard** - Display key metrics with trend indicators
   - Variants: Positive/Negative trends, with/without icons
   - Props: label, value, trend, isPositive, icon, hideTrendIcon

2. **ProjectCard** - Show project status and clip count
   - Variants: Processing, Completed
   - Props: title, clipsCount, status, thumbnail

3. **AIInsightCard** - AI-powered insights display
   - Single variant with coming soon message

### UI Components
4. **StatusBadge** - Status indicators
   - Variants: Completed, Pending, Failed (in sm/md sizes)
   - Props: status, size

5. **ProgressBar** - Visual progress indicators
   - Variants: Different heights, colors, animated/static
   - Props: value, color, label, animated, height

6. **Skeleton** - Loading placeholders
   - Variants: Circle, Rectangle, Text, Card, List, Table
   - Props: className

7. **Switch** - Toggle switches
   - Variants: On, Off, Interactive with labels
   - Props: checked, onChange, ariaLabel

### Project Components
8. **ClipCard** - Individual clip display with actions
   - Variants: High/Medium/Low score, Selected, Recommended
   - Props: id, title, thumbnail, score, duration, isSelected, isRecommended, callbacks

### Vault Components
9. **NFTCard** - NFT status and details
   - Variants: Ready to Mint, In Queue, Minted (all rarities)
   - Props: id, title, thumbnail, status, rarity, aiScore, prices

### Platform Components
10. **PlatformCard** - Social platform connections
    - Variants: Not Linked, Linked, Active, Loading (vertical/horizontal)
    - Props: name, description, icon, status, ctaText, username, variant

### Wallet Components
11. **WalletConnectButton** - Wallet connection UI
    - Variants: Disconnected, Connected, Loading, Error (compact/full)
    - Props: compact

## 🎨 Storybook Features

### Addons Installed

1. **@chromatic-com/storybook** - Visual testing and review
2. **@storybook/addon-vitest** - Component testing integration
3. **@storybook/addon-a11y** - Accessibility testing
4. **@storybook/addon-docs** - Auto-generated documentation
5. **@storybook/addon-mcp** - Model Context Protocol integration

### Interactive Controls

All stories include interactive controls that allow you to:
- Modify component props in real-time
- Test different states and variants
- Copy code snippets
- View auto-generated documentation

### Accessibility Testing

Every component includes built-in accessibility checks:
- ARIA labels and roles
- Keyboard navigation
- Color contrast
- Screen reader compatibility

## 📁 File Structure

```
clips-frontend/
├── .storybook/
│   ├── main.ts           # Storybook configuration
│   └── preview.tsx       # Global decorators and parameters
├── components/
│   ├── dashboard/
│   │   ├── StatCard.tsx
│   │   └── StatCard.stories.tsx
│   ├── ui/
│   │   ├── StatusBadge.tsx
│   │   └── StatusBadge.stories.tsx
│   └── ...
└── stories/
    └── Introduction.mdx  # Storybook introduction page
```

## ✍️ Writing Stories

### Basic Story Structure

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import MyComponent from './MyComponent';

const meta = {
  title: 'Category/MyComponent',
  component: MyComponent,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    propName: {
      control: 'text',
      description: 'Description of the prop',
    },
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    propName: 'value',
  },
};
```

### Story Naming Convention

- Use PascalCase for story names
- Name stories after the variant they represent
- Examples: `Default`, `Loading`, `WithError`, `LargeSize`

### Categories

Stories are organized into categories:
- `Dashboard/` - Dashboard-specific components
- `UI/` - Generic UI components
- `Projects/` - Project management components
- `Vault/` - NFT vault components
- `Platforms/` - Social platform components
- `Wallet/` - Wallet integration components

## 🚢 Deployment

### Option 1: Chromatic (Recommended)

Chromatic provides visual testing and hosting for Storybook.

```bash
# Install Chromatic
npm install --save-dev chromatic

# Publish to Chromatic
npx chromatic --project-token=<your-project-token>
```

**Setup Steps:**
1. Sign up at https://www.chromatic.com/
2. Create a new project
3. Get your project token
4. Add token to GitHub Secrets as `CHROMATIC_PROJECT_TOKEN`
5. Chromatic will auto-deploy on every push

### Option 2: Vercel

Deploy Storybook as a static site on Vercel.

```bash
# Build Storybook
npm run build-storybook

# Deploy to Vercel
npx vercel --prod storybook-static
```

**Setup Steps:**
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel login`
3. Build Storybook: `npm run build-storybook`
4. Deploy: `vercel --prod storybook-static`

### Option 3: GitHub Pages

Deploy to GitHub Pages for free hosting.

**Setup Steps:**
1. Build Storybook: `npm run build-storybook`
2. Push `storybook-static/` to `gh-pages` branch
3. Enable GitHub Pages in repository settings

**Automated Deployment:**

Create `.github/workflows/storybook.yml`:

```yaml
name: Deploy Storybook

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build-storybook
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./storybook-static
```

## 🧪 Testing with Storybook

### Visual Testing

Use Chromatic for visual regression testing:

```bash
npx chromatic --project-token=<token>
```

### Accessibility Testing

The a11y addon automatically checks for:
- Missing alt text
- Color contrast issues
- ARIA attribute problems
- Keyboard navigation issues

View results in the "Accessibility" panel.

### Component Testing

Use Vitest integration for component tests:

```bash
npx vitest
```

## 🎯 Best Practices

### Component Stories

1. **Show all variants** - Create stories for every state
2. **Use realistic data** - Use actual images and text
3. **Document props** - Add descriptions to argTypes
4. **Test interactions** - Include stories with user interactions
5. **Accessibility** - Always include ARIA labels

### Story Organization

1. **Group by feature** - Use categories that match your app structure
2. **Consistent naming** - Follow the naming convention
3. **Add descriptions** - Use MDX for complex documentation
4. **Include examples** - Show real-world usage

### Performance

1. **Lazy load images** - Use Next.js Image component
2. **Memoize components** - Use React.memo for expensive components
3. **Optimize stories** - Don't include unnecessary data

## 🔧 Configuration

### Tailwind CSS

Storybook is configured to use the project's Tailwind CSS:

```typescript
// .storybook/preview.tsx
import '../app/globals.css'
```

### Dark Theme

All components are displayed with dark background by default:

```typescript
parameters: {
  backgrounds: {
    default: 'dark',
    values: [
      { name: 'dark', value: '#050505' },
      { name: 'light', value: '#ffffff' },
    ],
  },
}
```

### Custom Decorators

Global decorator wraps all stories with proper styling:

```typescript
decorators: [
  (Story) => (
    <div className="min-h-screen bg-background text-white p-8">
      <Story />
    </div>
  ),
],
```

## 📖 Resources

- [Storybook Documentation](https://storybook.js.org/docs)
- [Storybook for Next.js](https://storybook.js.org/docs/get-started/frameworks/nextjs)
- [Chromatic Documentation](https://www.chromatic.com/docs/)
- [Accessibility Addon](https://storybook.js.org/addons/@storybook/addon-a11y)

## 🤝 Contributing

When adding new components:

1. Create the component in the appropriate directory
2. Add a `.stories.tsx` file next to the component
3. Include at least 3 variants (default, loading, error)
4. Add interactive controls for all props
5. Test accessibility with the a11y addon
6. Document complex props with descriptions

## 📝 Changelog

### v1.0.0 (2026-05-26)
- Initial Storybook setup
- Added 11 core component stories
- Configured Tailwind CSS integration
- Added accessibility testing
- Created introduction documentation

## 🐛 Troubleshooting

### Storybook won't start

```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
npm run storybook
```

### Components not rendering

Check that:
1. Global CSS is imported in `.storybook/preview.tsx`
2. Component paths are correct
3. All dependencies are installed

### Build fails

```bash
# Check for TypeScript errors
npx tsc --noEmit

# Build with verbose logging
npm run build-storybook -- --debug
```

## 📧 Support

For issues or questions:
- Open an issue on GitHub
- Check existing stories for examples
- Refer to Storybook documentation

---

**Last Updated**: May 26, 2026
**Storybook Version**: 10.4.1
**Status**: ✅ Ready for deployment

# Storybook Quick Start Guide

Quick reference for using and contributing to the ClipCash AI Storybook.

## 🚀 Running Storybook

```bash
# Start development server
npm run storybook

# Build static version
npm run build-storybook

# Preview static build
npx http-server storybook-static
```

**Access**: http://localhost:6006/

## 📖 Viewing Components

1. Start Storybook: `npm run storybook`
2. Browse components in left sidebar
3. Click on any story to view it
4. Use "Controls" tab to modify props
5. Check "Accessibility" tab for a11y issues
6. View "Docs" tab for auto-generated documentation

## ✍️ Creating a New Story

### 1. Create Story File

Create `ComponentName.stories.tsx` next to your component:

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import ComponentName from './ComponentName';

const meta = {
  title: 'Category/ComponentName',
  component: ComponentName,
  parameters: {
    layout: 'centered', // or 'padded', 'fullscreen'
  },
  tags: ['autodocs'],
  argTypes: {
    propName: {
      control: 'text', // or 'boolean', 'select', 'number'
      description: 'Description of the prop',
    },
  },
} satisfies Meta<typeof ComponentName>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default story
export const Default: Story = {
  args: {
    propName: 'value',
  },
};

// Additional variants
export const Variant: Story = {
  args: {
    propName: 'different value',
  },
};
```

### 2. Control Types

```typescript
argTypes: {
  text: { control: 'text' },
  number: { control: 'number' },
  boolean: { control: 'boolean' },
  select: { 
    control: 'select',
    options: ['option1', 'option2']
  },
  range: { 
    control: { type: 'range', min: 0, max: 100, step: 1 }
  },
  color: { control: 'color' },
  date: { control: 'date' },
}
```

### 3. Story Variants

```typescript
// Simple variant
export const Loading: Story = {
  args: {
    isLoading: true,
  },
};

// Custom render
export const Complex: Story = {
  render: (args) => (
    <div className="flex gap-4">
      <ComponentName {...args} />
      <ComponentName {...args} variant="alt" />
    </div>
  ),
};

// With decorators
export const WithWrapper: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
};
```

## 📂 Story Organization

### Categories

- `Dashboard/` - Dashboard components
- `UI/` - Generic UI components
- `Projects/` - Project management
- `Vault/` - NFT vault components
- `Platforms/` - Social platforms
- `Wallet/` - Wallet integration
- `Forms/` - Form components
- `Navigation/` - Navigation components

### Naming Convention

```typescript
// ✅ Good
export const Default: Story = {};
export const Loading: Story = {};
export const WithError: Story = {};
export const LargeSize: Story = {};

// ❌ Avoid
export const story1: Story = {};
export const test: Story = {};
export const example: Story = {};
```

## 🎨 Common Patterns

### Multiple States

```typescript
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Component status="idle" />
      <Component status="loading" />
      <Component status="success" />
      <Component status="error" />
    </div>
  ),
};
```

### Interactive Example

```typescript
import { useState } from 'react';

export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <Component 
        value={value} 
        onChange={setValue}
      />
    );
  },
};
```

### With Mock Data

```typescript
const mockData = {
  id: '1',
  title: 'Example',
  items: [1, 2, 3],
};

export const WithData: Story = {
  args: {
    data: mockData,
  },
};
```

## ♿ Accessibility

### Required Attributes

```typescript
// Always include
<button aria-label="Close dialog">
<input aria-label="Email address" />
<div role="alert" aria-live="polite">
```

### Testing

1. Run Storybook
2. Open story
3. Click "Accessibility" tab
4. Fix any violations
5. Test keyboard navigation

## 🧪 Testing Stories

### Visual Testing

```bash
# With Chromatic
npx chromatic --project-token=<token>
```

### Component Testing

```bash
# With Vitest
npx vitest
```

## 📝 Documentation

### Add Descriptions

```typescript
const meta = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    docs: {
      description: {
        component: 'A reusable button component with multiple variants.',
      },
    },
  },
  argTypes: {
    variant: {
      description: 'The visual style of the button',
      control: 'select',
      options: ['primary', 'secondary', 'ghost'],
    },
  },
};
```

### MDX Documentation

Create `ComponentName.mdx`:

```mdx
import { Meta, Story, Canvas } from '@storybook/blocks';
import * as ComponentStories from './ComponentName.stories';

<Meta of={ComponentStories} />

# Component Name

Description of the component.

## Usage

<Canvas of={ComponentStories.Default} />

## Variants

<Canvas of={ComponentStories.Variant1} />
<Canvas of={ComponentStories.Variant2} />
```

## 🚢 Deployment

### GitHub Pages

```bash
# Automatic on push to main
git push origin main

# Manual
npm run build-storybook
# Push storybook-static/ to gh-pages branch
```

### Chromatic

```bash
npx chromatic --project-token=<your-token>
```

### Vercel

```bash
npm run build-storybook
vercel --prod storybook-static
```

## 🐛 Troubleshooting

### Story Not Showing

- Check file name ends with `.stories.tsx`
- Verify export default meta
- Check for TypeScript errors
- Restart Storybook

### Styles Not Applied

- Ensure `globals.css` imported in `.storybook/preview.tsx`
- Check Tailwind classes are correct
- Verify component is wrapped in decorator

### Controls Not Working

- Check argTypes configuration
- Verify prop types in component
- Ensure args are passed to component

### Build Fails

```bash
# Clear cache
rm -rf node_modules/.cache

# Reinstall
npm install

# Try again
npm run build-storybook
```

## 📚 Resources

- [Storybook Docs](https://storybook.js.org/docs)
- [Writing Stories](https://storybook.js.org/docs/writing-stories)
- [Controls](https://storybook.js.org/docs/essentials/controls)
- [Accessibility](https://storybook.js.org/docs/writing-tests/accessibility-testing)

## 💡 Tips

1. **Start simple** - Begin with a default story
2. **Add variants** - Show all component states
3. **Use controls** - Make props interactive
4. **Test accessibility** - Check a11y tab
5. **Document props** - Add descriptions
6. **Show examples** - Include real-world usage
7. **Keep organized** - Use consistent categories
8. **Update regularly** - Keep stories in sync with components

## 🎯 Checklist for New Stories

- [ ] Story file created next to component
- [ ] Default story added
- [ ] At least 3 variants included
- [ ] All props have controls
- [ ] Accessibility labels added
- [ ] Component documented
- [ ] TypeScript types correct
- [ ] Story tested in Storybook
- [ ] No console errors
- [ ] Accessibility checks pass

---

**Need Help?** Check [STORYBOOK.md](./STORYBOOK.md) for detailed documentation.

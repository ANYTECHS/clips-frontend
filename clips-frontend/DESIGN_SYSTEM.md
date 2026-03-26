# ClipCash Design System

## Brand Colors

### Primary Brand Color
- **Primary**: `#00FF9D` - Main brand color for CTAs, highlights, and key interactions
- **Primary Hover**: `#00E68D` - Hover state for primary elements
- **Primary Light**: `#88FFD9` - Lighter variant for secondary uses

Usage in Tailwind:
```tsx
<button className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)]">
  Connect Account
</button>
```

## Dark Mode Palette

### Backgrounds
- **Page Background**: `#050505` - Main page background
- **Card Background**: `#121212` - Standard card background
- **Card Elevated**: `#1A1A1A` - Elevated/hover card state
- **Border**: `#2A2A2A` - Border color for cards and dividers

### Text Colors
- **Foreground**: `#f5f7fb` - Primary text color
- **Heading**: `#f6f4f0` - Heading text color
- **Muted**: `#8d97ac` - Secondary/muted text

## Border Radius Standards

- **Cards**: `rounded-2xl` (1rem) - Use for all card components
- **Buttons**: `rounded-lg` (0.5rem) - Use for buttons and interactive elements
- **Inputs**: `rounded-lg` (0.5rem) - Use for form inputs
- **Badges**: `rounded-md` (0.375rem) - Use for status badges and tags

## Typography

### Font Stack
Sans-serif system font stack optimized for cross-platform consistency:
```
ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 
"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
```

Usage: Applied automatically via `font-sans` class or body default.

## Status Colors

### Processing
- Background: `rgba(0, 255, 157, 0.15)`
- Text: `#00FF9D`
- Includes animated pulse effect

### Completed
- Background: `#23252b`
- Text: `#98a0af`

### Error
- Background: `rgba(239, 68, 68, 0.15)`
- Text: `#EF4444`

## Usage Examples

### Card Component
```tsx
<div className="bg-[var(--card-background)] border border-[var(--border-color)] rounded-2xl p-6">
  <h2 className="text-[var(--heading-color)]">Card Title</h2>
  <p className="text-[var(--muted-text)]">Card description</p>
</div>
```

### Button Component
```tsx
<button className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-black rounded-lg px-4 py-2">
  Primary Action
</button>
```

### Status Badge
```tsx
<span className="status-processing px-3 py-1 rounded-md text-sm">
  Processing
</span>
```

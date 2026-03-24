# Bento-Box Grid System Documentation

## Overview
The Bento-Box grid system is a responsive 12-column CSS Grid layout designed to create flexible, card-based dashboards that adapt seamlessly from mobile (320px) to ultra-wide displays (1920px+).

## Features
- ✅ 12-column grid system for desktop
- ✅ Fully responsive from 320px to 1920px
- ✅ Consistent spacing (gap) between cards at all breakpoints
- ✅ Bento layout with 2/3 and 1/3 column spans
- ✅ Mobile-first approach with vertical stacking
- ✅ Smooth transitions and hover effects

## Breakpoints

| Breakpoint | Width | Columns | Gap | Behavior |
|------------|-------|---------|-----|----------|
| Mobile | 320px - 639px | 1 | 16px | Stack vertically |
| Tablet | 640px - 1023px | 6 | 20px | 2-3 columns |
| Desktop | 1024px - 1439px | 12 | 24px | Full grid |
| Large Desktop | 1440px - 1919px | 12 | 32px | Full grid |
| Extra Large | 1920px+ | 12 | 32px | Full grid |

## Core Classes

### Grid Container
```html
<div className="bento-grid">
  <!-- Grid items go here -->
</div>
```

### Grid Items - Column Spans

#### Desktop (1024px+)
- `.bento-item-full` - 12 columns (100%)
- `.bento-item-two-thirds` - 8 columns (66.67%)
- `.bento-item-one-third` - 4 columns (33.33%)
- `.bento-item-half` - 6 columns (50%)
- `.bento-item-third` - 4 columns (33.33%)
- `.bento-item-quarter` - 3 columns (25%)

#### Tablet (640px+)
- `.bento-item-full` - 6 columns (100%)
- `.bento-item-half` - 3 columns (50%)
- `.bento-item-third` - 2 columns (33.33%)

#### Mobile (320px+)
All items span 1 column (100% width)

### Card Styles
- `.bento-card` - Base card styling with background, border, and padding
- `.bento-card-tall` - Minimum height of 400px
- `.bento-card-medium` - Minimum height of 300px
- `.bento-card-short` - Minimum height of 200px

### Specialized Classes
- `.bento-revenue-trend` - Revenue card (2/3 width on desktop)
- `.bento-distribution` - Distribution card (1/3 width on desktop)
- `.bento-stat-card` - Stat card (1/3 width on desktop, stacks on mobile)

## Usage Examples

### Basic Bento Layout (2/3 + 1/3)
```tsx
<div className="bento-grid">
  {/* Revenue Trend - 2/3 width */}
  <div className="bento-revenue-trend bento-card bento-card-tall">
    <h3>Revenue Trend</h3>
    {/* Content */}
  </div>
  
  {/* Distribution - 1/3 width */}
  <div className="bento-distribution bento-card bento-card-tall">
    <h3>Distribution</h3>
    {/* Content */}
  </div>
</div>
```

### Three Equal Columns
```tsx
<div className="bento-grid">
  <div className="bento-stat-card bento-card">Card 1</div>
  <div className="bento-stat-card bento-card">Card 2</div>
  <div className="bento-stat-card bento-card">Card 3</div>
</div>
```

### Mixed Layout
```tsx
<div className="bento-grid">
  {/* Full width header */}
  <div className="bento-item-full bento-card bento-card-short">
    Header Card
  </div>
  
  {/* 2/3 + 1/3 row */}
  <div className="bento-item-two-thirds bento-card bento-card-tall">
    Main Content
  </div>
  <div className="bento-item-one-third bento-card bento-card-tall">
    Sidebar
  </div>
  
  {/* Three equal columns */}
  <div className="bento-item-third bento-card">Column 1</div>
  <div className="bento-item-third bento-card">Column 2</div>
  <div className="bento-item-third bento-card">Column 3</div>
</div>
```

## Responsive Behavior

### Mobile (320px - 639px)
- All cards stack vertically
- Single column layout
- 16px gap between cards
- Full width cards for easy touch interaction

### Tablet (640px - 1023px)
- 6-column grid
- Cards can span 2, 3, or 6 columns
- 20px gap between cards
- Balanced layout for medium screens

### Desktop (1024px+)
- Full 12-column grid
- Precise control over card widths
- 24px gap (32px on 1440px+)
- Bento layout with 2/3 and 1/3 spans

## Customization

### Adjusting Gap Spacing
Edit the `gap` property in `bento-grid.css`:
```css
.bento-grid {
  gap: 1.5rem; /* Change this value */
}
```

### Custom Column Spans
Add custom classes for specific layouts:
```css
.bento-custom-span {
  grid-column: span 5; /* Custom 5-column span */
}
```

### Card Heights
Adjust minimum heights:
```css
.bento-card-custom {
  min-height: 350px;
}
```

## Best Practices

1. **Consistent Spacing**: Use the predefined gap values to maintain visual consistency
2. **Mobile First**: Design for mobile, then enhance for larger screens
3. **Content Hierarchy**: Use larger spans (2/3) for primary content
4. **Accessibility**: Ensure cards have proper heading structure and ARIA labels
5. **Performance**: Use CSS Grid for layout, avoid JavaScript-based grid systems

## Browser Support
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Full support

## Testing Checklist
- [ ] Layout works at 320px (iPhone SE)
- [ ] Layout works at 375px (iPhone 12)
- [ ] Layout works at 768px (iPad)
- [ ] Layout works at 1024px (Desktop)
- [ ] Layout works at 1440px (Large Desktop)
- [ ] Layout works at 1920px (Full HD)
- [ ] Gap spacing is consistent across breakpoints
- [ ] Cards don't overflow container
- [ ] Touch targets are adequate on mobile (min 44px)
- [ ] Hover effects work on desktop
- [ ] No horizontal scrolling at any breakpoint

## Integration with Existing Components

The Bento grid system is already integrated with:
- `StatCardGroup` - Three stat cards that span equal widths
- `RevenueTrendCard` - 2/3 width revenue chart
- `DistributionCard` - 1/3 width distribution breakdown

To add new cards, simply wrap them with the appropriate Bento classes.

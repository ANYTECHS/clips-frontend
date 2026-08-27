# Performance Budgets

This document explains the performance budget system and how to maintain optimal application performance.

## Overview

Performance budgets define limits on bundle sizes and web vitals to catch regressions early and keep the application fast.

## Bundle Size Budgets

Budgets are defined in `next.performance.json`:

```json
{
  "bundles": [
    { "name": "main", "maxSize": "250kb" },
    { "name": "commons", "maxSize": "150kb" },
    { "name": "dashboard", "maxSize": "100kb" },
    { "name": "analytics", "maxSize": "80kb" }
  ]
}
```

### Current Budgets

| Bundle | Max Size | Purpose |
|--------|----------|---------|
| main | 250kb | Core application code |
| commons | 150kb | Shared dependencies |
| dashboard | 100kb | Dashboard route |
| analytics | 80kb | Analytics route |

All sizes are gzipped and measured in kilobytes.

## Web Vitals Targets

| Metric | Threshold | Description |
|--------|-----------|-------------|
| LCP | 2500ms | Largest Contentful Paint |
| FID | 100ms | First Input Delay |
| CLS | 0.1 | Cumulative Layout Shift |
| TTFB | 600ms | Time to First Byte |

## Monitoring

### Build-Time Check

Performance budget check runs automatically during build:

```bash
npm run build
```

Output:
```
📦 Bundle Size Budget Check:

✅ main: 185.32kb / 250 (74.13%)
✅ commons: 98.45kb / 150 (65.63%)
✅ dashboard: 72.18kb / 100 (72.18%)
✅ analytics: 65.99kb / 80 (82.49%)

✅ All bundles within budget!
```

### Analyzing Bundles

```bash
npm run analyze
```

This generates an interactive visualization showing:
- Bundle composition
- Module sizes
- Dependency tree
- Potential optimizations

### Viewing Coverage

```bash
npm run bundle:report
```

## Optimization Strategies

### 1. Code Splitting

Ensure routes and large features are code-split:

```typescript
// ✅ Good: Dynamic import
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
});

// ❌ Avoid: Always imported
import HeavyComponent from './HeavyComponent';
```

### 2. Dependency Optimization

Use optimized package imports in `next.config.ts`:

```typescript
experimental: {
  optimizePackageImports: [
    "lucide-react",
    "@stellar/stellar-sdk",
    "zod",
  ],
}
```

This converts barrel imports to deep imports automatically.

### 3. Remove Unused Code

```bash
# Find unused dependencies
npm audit

# Review dependencies with
npm ls
```

### 4. Lazy Load Non-Critical Features

```typescript
// Load analytics after page interactive
useEffect(() => {
  import('analytics-lib').then(({ trackPageView }) => {
    trackPageView();
  });
}, []);
```

### 5. Optimize Images

```typescript
// ✅ Use Next.js Image component
<Image
  src="/image.png"
  width={200}
  height={200}
  priority={false} // Only set true for above-fold
/>

// ❌ Avoid unoptimized images
<img src="/image.png" />
```

## Handling Budget Violations

### When a build fails:

1. **Identify the problem**:
```bash
npm run analyze
```

2. **Check what changed**:
```bash
git diff next.config.ts
git log --oneline -n 5
```

3. **Optimize**:
   - Lazy load routes/features
   - Remove unused dependencies
   - Use tree-shaking friendly imports
   - Review imports for side-effects

4. **If optimization isn't possible**, request budget increase with justification:
   - Update `next.performance.json`
   - Document reason in commit message
   - Requires code review approval

### Example: Adding a new library

Before:
```json
{ "name": "main", "maxSize": "250kb" }
```

After adding large library:
- Build fails with main: 285kb (exceeds 250kb)

Options:
1. **Code-split the feature** (preferred):
```typescript
const FeatureWithLibrary = dynamic(() => import('./Feature'));
```

2. **Find alternative** with smaller size

3. **Increase budget** with justification:
```json
{ "name": "main", "maxSize": "300kb" }
```

## CI/CD Integration

Performance budget check runs in CI pipeline:

```yaml
# .github/workflows/ci.yml
- name: Check Performance Budget
  run: npm run build
```

Build fails if any bundle exceeds budget. Merge is blocked until resolved.

## Monitoring in Production

Use Web Vitals tracking via Sentry:

```typescript
import * as Sentry from "@sentry/nextjs";

// Automatically tracks CLS, FID, LCP, TTFB
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT,
});
```

View metrics in Sentry dashboard:
- Performance trends
- Regional differences
- Device-specific issues
- Error correlations

## Performance Guidelines

### For Developers

- Always check bundle size before opening PR
- Run `npm run analyze` for large changes
- Use dynamic imports for code >50kb
- Remove unused dependencies
- Minimize client-side dependencies

### For Code Review

- Request `npm run analyze` output for bundle changes
- Question new large dependencies
- Verify code-splitting for new features
- Check Web Vitals impact

### For DevOps

- Monitor production Web Vitals
- Alert on budget violations
- Track trends over time
- Compare against competitors

## Resources

- [Web.dev Performance](https://web.dev/performance/)
- [Next.js Performance](https://nextjs.org/learn/seo/web-performance)
- [Webpack Bundle Analysis](https://webpack.js.org/guides/code-splitting/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)

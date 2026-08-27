# Testing & Performance Infrastructure

Welcome to the Clips Frontend testing infrastructure. This document provides a quick start guide.

## Quick Start

### Run All Tests
```bash
npm test                  # Unit tests (watch mode)
npm run test:integration  # API integration tests
npm run test:visual       # Visual regression tests
npm run test:e2e         # End-to-end tests
```

### CI-Ready Commands
```bash
npm test -- --ci --coverage              # Unit tests with coverage
npm run test:integration -- --coverage   # Integration tests with coverage
npm run test:visual                       # Visual regression (updates baselines if needed)
npm run build                            # Includes performance budget validation
```

## What's Tested

### Unit Tests (70%+ coverage target)
- **Components**: Rendered output, interactions, edge cases
- **Utilities**: Input/output, error handling, edge cases
- **Hooks**: State changes, side effects, cleanup

Example:
```typescript
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

it('should handle clicks', async () => {
  const handleClick = jest.fn();
  render(<Button onClick={handleClick}>Click me</Button>);
  
  await userEvent.click(screen.getByRole('button'));
  expect(handleClick).toHaveBeenCalled();
});
```

### Integration Tests (API routes)
- Database operations
- Authentication flows
- API contract compliance
- Error responses

Example:
```typescript
import { POST } from '@/app/api/projects/route';
import { createMockRequest, createMockSession } from '../helpers/api-test-client';

it('should create a project', async () => {
  const request = createMockRequest({
    method: 'POST',
    body: { name: 'New Project' },
    session: createMockSession(),
  });

  const response = await POST(request);
  expect(response.status).toBe(201);
});
```

### Visual Regression Tests
- Dashboard layouts
- Component appearance
- Responsive designs
- Dark/light mode (if applicable)

Example:
```typescript
test('should match dashboard snapshot', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'networkidle' });
  await expect(page).toHaveScreenshot('dashboard.png');
});
```

### Performance Budgets
- Bundle size limits (monitored at build time)
- Web Vitals targets
- Build-time enforcement

Example monitoring:
```bash
$ npm run build
...
📦 Bundle Size Budget Check:
✅ main: 185kb / 250kb (74%)
✅ commons: 98kb / 150kb (65%)
✅ dashboard: 72kb / 100kb (72%)
✅ analytics: 66kb / 80kb (82%)
✅ All bundles within budget!
```

## File Organization

```
project-root/
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx          # Co-located unit tests
├── app/
│   ├── lib/
│   │   ├── sanitize.ts
│   │   └── sanitize.test.ts     # Co-located unit tests
│   ├── hooks/
│   │   └── useProcessingStatus.test.ts
│   └── api/                      # API routes tested in __tests__/
├── __tests__/
│   └── integration/
│       ├── helpers/
│       │   ├── api-test-client.ts
│       │   └── database-mock.ts
│       └── api/
│           ├── database.test.ts
│           ├── health.test.ts
│           └── authentication.test.ts
├── tests/
│   ├── e2e/                      # Playwright E2E tests
│   │   ├── critical-journey.spec.ts
│   │   └── visual.spec.ts        # Visual regression tests
│   └── visual-baselines/         # Visual test snapshots
├── docs/
│   ├── TESTING_GUIDE.md          # Detailed testing documentation
│   └── PERFORMANCE_BUDGETS.md    # Performance documentation
└── next.performance.json         # Performance budget definitions
```

## Writing Your First Test

### Unit Test (Component)

```typescript
// components/Card.test.tsx
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('should render title', () => {
    render(<Card title="My Card">Content</Card>);
    expect(screen.getByText('My Card')).toBeInTheDocument();
  });

  it('should apply variant class', () => {
    const { container } = render(
      <Card variant="elevated" title="Card">Content</Card>
    );
    expect(container.querySelector('.card-elevated')).toBeInTheDocument();
  });
});
```

### Integration Test (API)

```typescript
// __tests__/integration/api/items.test.ts
import { GET } from '@/app/api/items/route';
import { createMockRequest, createMockSession } from '../helpers/api-test-client';

describe('Items API', () => {
  it('should list items for user', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/items',
      session: createMockSession(),
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data.items)).toBe(true);
  });
});
```

### Visual Test (Page)

```typescript
// tests/e2e/pages.spec.ts
test('should match settings page', async ({ page }) => {
  await page.goto('/settings', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="settings-form"]');
  
  await expect(page).toHaveScreenshot('settings-page.png', {
    fullPage: true,
    mask: [
      page.locator('[data-testid="api-keys"]'), // Mask sensitive data
    ],
  });
});
```

## Debugging

### Debug Unit Tests
```bash
# Run specific file
npm test Button.test.tsx

# Run tests matching name pattern
npm test -- --testNamePattern="should render"

# Watch mode (re-runs on file change)
npm test -- --watch

# See console output
npm test -- --verbose
```

### Debug Integration Tests
```bash
# Run all integration tests
npm run test:integration

# Debug mode
npm run test:integration -- --detectOpenHandles

# Show logs
npm run test:integration -- --verbose
```

### Debug Visual Tests
```bash
# Run headed mode (see browser)
npm run test:visual -- --headed

# Debug mode with inspector
npx playwright test tests/e2e/visual.spec.ts --debug

# Update baselines if intentional changes
npm run test:visual:update
```

## Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View coverage report
open coverage/lcov-report/index.html  # macOS
# or
start coverage/lcov-report/index.html # Windows
```

## Performance Budgets

### View Current Status
```bash
npm run build  # Includes budget check
```

### Analyze Bundle
```bash
npm run analyze
```

### Update Budget (if necessary)
Edit `next.performance.json`:
```json
{
  "bundles": [
    { "name": "main", "maxSize": "250kb" }
  ]
}
```

## Best Practices

### ✅ Do

- Write tests for critical paths first
- Test behavior, not implementation
- Use descriptive test names
- Mock external dependencies
- Keep tests isolated and independent
- Use `data-testid` for reliable selectors
- Mask dynamic content in visual tests

### ❌ Don't

- Test implementation details
- Create brittle tests with multiple assertions
- Skip tests in CI (flaky tests should be fixed)
- Leave unused test files
- Ignore visual test diffs
- Create tests that depend on execution order

## Common Issues

### "Test timeout"
Increase timeout for slow operations:
```typescript
test('slow operation', async () => {
  // ...
}, 30000); // 30 seconds
```

### "Can't find element"
Ensure element is rendered before querying:
```typescript
await page.waitForSelector('[data-testid="button"]');
const button = page.locator('[data-testid="button"]');
```

### "Flaky visual test"
Mask dynamic content:
```typescript
await expect(page).toHaveScreenshot('page.png', {
  mask: [
    page.locator('[data-testid="timestamp"]'),
  ],
});
```

### "Performance budget exceeded"
Analyze and optimize:
```bash
npm run analyze
# Check for large dependencies, missing code-splitting, etc.
```

## Resources

- **Jest**: https://jestjs.io/
- **React Testing Library**: https://testing-library.com/
- **Playwright**: https://playwright.dev/
- **Testing Best Practices**: https://kentcdodds.com/blog/common-mistakes-with-react-testing-library
- **Performance**: https://web.dev/performance/

## Need Help?

See the detailed guides:
- `docs/TESTING_GUIDE.md` - Complete testing documentation
- `docs/PERFORMANCE_BUDGETS.md` - Performance budget details

Or check test examples in:
- `components/Button.test.tsx`
- `__tests__/integration/api/`
- `tests/e2e/visual.spec.ts`

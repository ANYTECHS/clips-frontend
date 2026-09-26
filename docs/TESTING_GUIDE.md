# Testing Guide

This document outlines the testing strategy and guidelines for the Clips Frontend project.

## Overview

We implement a multi-layered testing strategy to ensure code quality, performance, and visual consistency:

- **Unit Tests**: Test individual components and utilities
- **Integration Tests**: Test API routes and data flows
- **Visual Regression Tests**: Catch unintended UI changes
- **E2E Tests**: Validate complete user journeys
- **Performance Budgets**: Monitor and enforce bundle size limits

## Running Tests

### Unit Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test:coverage
```

**Coverage targets:**
- Functions: 80%+
- Branches: 75%+
- Lines: 80%+
- Statements: 80%+

### Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run integration tests with coverage
npm run test:coverage:integration
```

**What we test:**
- API route handlers
- Database operations
- Authentication flows
- Error handling

### Visual Regression Tests

```bash
# Run visual regression tests
npm run test:visual

# Update baseline snapshots (after intentional changes)
npm run test:visual:update
```

**What we capture:**
- Dashboard layouts
- Component cards
- Navigation menus
- Responsive designs (mobile, tablet, desktop)
- Analytics charts

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests in headed mode (see browser)
npm run test:e2e -- --headed

# Run specific test file
npm run test:e2e -- tests/e2e/critical-journey.spec.ts
```

## Writing Tests

### Unit Tests

Unit tests should be located next to the component/utility they test with `.test.ts` or `.test.tsx` extension.

```typescript
// components/Button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('should handle clicks', async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    
    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

**Guidelines:**
- One assertion per test when possible
- Use descriptive test names
- Test behavior, not implementation
- Mock external dependencies

### Integration Tests

Integration tests for API routes go in `__tests__/integration/`.

```typescript
// __tests__/integration/api/projects.test.ts
import { createMockRequest, expectStatus } from '../helpers/api-test-client';
import { POST } from '@/app/api/projects/route';

describe('Projects API', () => {
  it('should create project with valid data', async () => {
    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/projects',
      body: { name: 'My Project' },
      session: createMockSession(),
    });

    const response = await POST(request);
    expectStatus(response, 201);
  });
});
```

**Available helpers:**
- `createMockRequest()`: Create mock Next.js requests
- `createMockSession()`: Create mock NextAuth sessions
- `createMockUser()`, `createMockProject()`: Create test data
- `mockDb`: In-memory database for testing

### Visual Regression Tests

Visual tests go in `tests/e2e/visual.spec.ts` using Playwright.

```typescript
test('should match dashboard snapshot', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="dashboard-header"]');
  
  await expect(page).toHaveScreenshot('dashboard-full.png', {
    fullPage: true,
    mask: [
      page.locator('[data-testid="timestamp"]'),  // Mask dynamic content
    ],
  });
});
```

**Best practices:**
- Wait for critical content before capturing
- Mask dynamic/time-dependent elements
- Use data-testid attributes for reliable selectors
- Test key user journeys and components
- Test responsive breakpoints

## Test Data & Mocking

### Database Mocking

```typescript
import { mockDb, createMockUser, createMockProject } from '../helpers/database-mock';

beforeEach(() => {
  mockDb.reset(); // Clear state before each test
});

it('should work with test data', () => {
  const user = createMockUser();
  mockDb.users.set(user.id, user);
  
  expect(mockDb.users.has(user.id)).toBe(true);
});
```

### Request/Response Mocking

```typescript
import { createMockRequest } from '../helpers/api-test-client';

const request = createMockRequest({
  method: 'POST',
  url: 'http://localhost:3000/api/endpoint',
  body: { key: 'value' },
  headers: { 'x-custom': 'header' },
  session: authenticatedSession,
});
```

## Performance Budgets

Performance budgets are defined in `next.performance.json`:

```json
{
  "bundles": [
    { "name": "main", "maxSize": "250kb" },
    { "name": "commons", "maxSize": "150kb" }
  ],
  "metrics": {
    "LCP": { "threshold": 2500, "unit": "ms" },
    "FID": { "threshold": 100, "unit": "ms" },
    "CLS": { "threshold": 0.1, "unit": "unitless" }
  }
}
```

The budget is checked automatically during build:

```bash
npm run build
```

To analyze bundle size:

```bash
npm run analyze
```

### Handling Budget Violations

If a build fails due to exceeding budget:

1. **Check bundle composition**: `npm run analyze`
2. **Identify culprits**: Look for large dependencies or missing code-splitting
3. **Optimize**:
   - Remove unused dependencies
   - Use dynamic imports for large features
   - Review `next.config.ts` for code-splitting opportunities
4. **Update budget** (only if necessary):
   - Edit `next.performance.json`
   - Document the reason in PR

## CI/CD Integration

Tests run in CI pipeline:

1. **Unit tests**: `npm test` (on every push)
2. **Integration tests**: `npm run test:integration` (required for merged)
3. **Visual tests**: `npm run test:visual` (on PR)
4. **Build validation**: Performance budget check (required)
5. **E2E tests**: `npm run test:e2e` (on main branch)

See `.github/workflows/ci.yml` for details.

## Test Coverage

View coverage reports:

```bash
# Generate coverage report
npm run test:coverage

# Report opens in default browser from ./coverage/lcov-report/index.html
```

### Coverage Standards

- **Utilities**: 100% coverage required
- **Hooks**: 80%+ coverage
- **Components**: 70%+ coverage
- **API routes**: 80%+ coverage

Critical paths must have higher coverage:
- Authentication flows: 90%+
- Validation logic: 95%+
- Error handling: 85%+

## Debugging Tests

### Debug unit tests

```bash
# Run with additional debugging output
npm test -- --verbose

# Run single test file
npm test -- components/Button.test.tsx

# Run tests matching pattern
npm test -- --testNamePattern="should render"
```

### Debug E2E tests

```bash
# Run in headed mode (see the browser)
npm run test:e2e -- --headed

# Debug mode with inspector
npx playwright test --debug
```

### Debug visual tests

```bash
# Generate visual report
npm run test:visual:update

# Compare baseline vs actual in report
open test-results/index.html
```

## Common Issues

### Tests timeout

Increase timeout in test:
```typescript
test('slow operation', async () => {
  // test code
}, 30000); // 30 second timeout
```

### Flaky tests

- Avoid time-dependent assertions
- Use proper wait strategies: `waitFor()`, `waitForSelector()`
- Mock network requests
- Avoid hardcoded delays

### Visual test drift

When intentional UI changes occur:
```bash
npm run test:visual:update
git diff tests/visual-baselines/  # Review changes
git add tests/visual-baselines/
```

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

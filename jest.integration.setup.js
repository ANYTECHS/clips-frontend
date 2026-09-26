// Integration test setup for API routes
import '@testing-library/jest-dom';

// Mock environment variables for testing
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'test';

// Global test timeout for integration tests
jest.setTimeout(30000);

// Mock next/router for server-side usage
jest.mock('next/router', () => ({
  useRouter: () => ({
    query: {},
    pathname: '',
    asPath: '',
    push: jest.fn(),
  }),
}));

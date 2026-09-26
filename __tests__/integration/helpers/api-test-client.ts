import { NextRequest } from 'next/server';
import { Session } from 'next-auth';

/**
 * Helper to mock NextRequest for API route testing
 */
export function createMockRequest(
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    url?: string;
    body?: Record<string, any>;
    headers?: Record<string, string>;
    session?: Session | null;
  } = {}
): NextRequest {
  const {
    method = 'GET',
    url = 'http://localhost:3000/api/test',
    body,
    headers = {},
    session = null,
  } = options;

  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    requestInit.body = JSON.stringify(body);
  }

  // Add session to headers if provided
  if (session) {
    requestInit.headers = {
      ...requestInit.headers,
      'x-session': JSON.stringify(session),
    };
  }

  return new NextRequest(new URL(url), requestInit);
}

/**
 * Helper to extract JSON response body
 */
export async function getResponseBody(response: Response): Promise<any> {
  const clonedResponse = response.clone();
  return clonedResponse.json();
}

/**
 * Mock NextAuth session for testing
 */
export function createMockSession(overrides?: Partial<Session>): Session {
  return {
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  } as Session;
}

/**
 * Assert response status
 */
export function expectStatus(response: Response, expected: number): void {
  if (response.status !== expected) {
    throw new Error(`Expected status ${expected}, got ${response.status}`);
  }
}

/**
 * Assert response has JSON
 */
export async function expectJsonBody(response: Response, expected: any): Promise<void> {
  const body = await getResponseBody(response);
  expect(body).toEqual(expected);
}

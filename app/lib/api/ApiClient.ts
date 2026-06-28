import { getSession } from 'next-auth/react';

export type ApiErrorShape = {
  error: string;
  code: string;
  details?: unknown;
};

export class ApiResponseError extends Error {
  public readonly shape: ApiErrorShape;

  constructor(shape: ApiErrorShape, status?: number) {
    super(shape.error || `API error${status ? ` (${status})` : ''}`);
    this.name = 'ApiResponseError';
    this.shape = shape;
  }
}

export class ApiClient {
  private readonly base: string;

  constructor(baseUrl: string) {
    this.base = baseUrl.replace(/\/$/, '');
  }

  private async authHeader(): Promise<Record<string, string>> {
    try {
      const session = await getSession();
      // session may include an accessToken depending on NextAuth callbacks
      // try common locations
      const token = (session as any)?.accessToken || (session as any)?.token || null;
      if (token) return { Authorization: `Bearer ${token}` };
    } catch (err) {
      // ignore — no session on server or not configured
    }
    return {};
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(await this.authHeader()),
    };

    const init: RequestInit = {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    };

    try {
      const res = await fetch(`${this.base}${path}`, init);

      const text = await res.text().catch(() => '');
      const contentType = res.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') && text ? JSON.parse(text) : text;

      if (!res.ok) {
        const shape: ApiErrorShape = {
          error: (payload && (payload.error || payload.message)) || 'Unknown error',
          code: (payload && payload.code) || `HTTP_${res.status}`,
          details: payload && payload.details ? payload.details : undefined,
        };
        throw new ApiResponseError(shape, res.status);
      }

      return payload as T;
    } catch (err) {
      if (err instanceof ApiResponseError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new ApiResponseError({ error: message, code: 'NETWORK_ERROR' });
    }
  }

  get<T = unknown>(path: string): Promise<T> {
    return this.request('GET', path);
  }

  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request('POST', path, body);
  }

  put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request('PUT', path, body);
  }

  delete<T = unknown>(path: string): Promise<T> {
    return this.request('DELETE', path);
  }
}

export function createApiClient(): ApiClient | null {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return null;
  return new ApiClient(base);
}

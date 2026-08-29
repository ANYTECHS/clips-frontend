import { getSession } from 'next-auth/react';
import type { Session } from 'next-auth';
import { getJson, isSensitiveUrl, mutate, OfflineCacheMissError } from '@/app/lib/data-layer';

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
      const token = (session as Session & { accessToken?: string })?.accessToken || null;
      if (token) return { Authorization: `Bearer ${token}` };
    } catch {
      // ignore — no session on server or not configured
    }
    return {};
  }

  private tagsForPath(path: string): string[] {
    if (/dashboard/i.test(path)) return ['dashboard'];
    if (/earnings/i.test(path)) return ['earnings'];
    if (/\/users?(?:\/|$)/i.test(path) || /\/user(?:\/|$)/i.test(path)) return ['user'];
    if (/clip/i.test(path)) return ['clips', 'dashboard'];
    return [];
  }

  private shouldQueueMutation(path: string): boolean {
    if (isSensitiveUrl(path)) return false;
    if (/\/mint(?:\/|$)/i.test(path)) return false;
    return true;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(await this.authHeader()),
    };
    const url = `${this.base}${path}`;
    const tags = this.tagsForPath(path);
    const upper = method.toUpperCase();

    try {
      if (upper === 'GET' || upper === 'HEAD') {
        const result = await getJson<T>({
          method: upper,
          url,
          headers,
          tags,
          persist: !isSensitiveUrl(path),
        });
        if (!result.ok) {
          const payload = result.data as { error?: string; message?: string; code?: string; details?: unknown } | undefined;
          throw new ApiResponseError(
            {
              error: result.error || payload?.error || payload?.message || 'Unknown error',
              code: payload?.code || `HTTP_${result.status}`,
              details: payload?.details,
            },
            result.status,
          );
        }
        return result.data as T;
      }

      const result = await mutate<T>({
        method: upper as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        url,
        body,
        headers,
        invalidateTags: tags,
        queueWhenOffline: this.shouldQueueMutation(path),
      });

      if (result.queued) {
        return { queued: true } as T;
      }

      if (!result.ok) {
        const payload = result.data as { error?: string; message?: string; code?: string; details?: unknown } | undefined;
        throw new ApiResponseError(
          {
            error: result.error || payload?.error || payload?.message || 'Unknown error',
            code: payload?.code || (result.status ? `HTTP_${result.status}` : 'NETWORK_ERROR'),
            details: payload?.details,
          },
          result.status,
        );
      }

      return result.data as T;
    } catch (err) {
      if (err instanceof ApiResponseError) throw err;
      if (err instanceof OfflineCacheMissError) {
        throw new ApiResponseError({ error: err.message, code: 'OFFLINE' });
      }
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

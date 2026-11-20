import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createHash } from 'crypto';
import { logApiRequest, shouldLogBody } from '@/lib/apiLogger';

// Disable Next.js body parsing — we stream the raw body directly to the backend.
// Without this, Next.js buffers and size-limits request bodies (bad for uploads/SSE).
export const dynamic = 'force-dynamic';

// Issue #1394 — ETag support: compute a strong ETag for cacheable (JSON) GET
// responses and honour the client's If-None-Match header, answering with
// 304 Not Modified when the representation is unchanged.
async function computeEtag(
  req: NextRequest,
  backendRes: Response,
  responseHeaders: Headers,
  targetUrl: string
): Promise<string | undefined> {
  const method = req.method;
  if (method !== 'GET' && method !== 'HEAD') return undefined;
  if (backendRes.status !== 200) return undefined;
  const contentType = responseHeaders.get('content-type') || '';
  // SSE streams and binary payloads are not cacheable here.
  if (contentType.includes('text/event-stream')) return undefined;
  if (!contentType.includes('json') && !contentType.includes('text/')) return undefined;

  const body = await backendRes.clone().text();
  const hash = createHash('sha256').update(`${targetUrl}:${body}`).digest('hex').slice(0, 32);
  const etag = `"${hash}"`;
  responseHeaders.set('etag', etag);
  return etag;
}

async function handler(req: NextRequest) {
  const startedAt = Date.now();
  const baseUrl = (process.env.API_URL || 'https://clipcash-api.onrender.com').replace(/\/+$/, '');

  const path = req.nextUrl.pathname.replace(/^\/api\/proxy/, '');
  const search = req.nextUrl.search;
  const targetUrl = `${baseUrl}${path}${search}`;
  let bodyText: string | null = null;

  const headers = new Headers(req.headers);
  headers.delete('host');
  // Tell the backend not to compress — Node's fetch auto-decompresses,
  // so forwarding a compressed body causes ERR_CONTENT_DECODING_FAILED
  headers.delete('accept-encoding');
  // Remove content-length to let fetch/undici calculate it correctly
  headers.delete('content-length');

  // Explicitly forward all cookies from the browser to the backend
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  if (allCookies.length > 0) {
    const cookieHeader = allCookies.map(c => `${c.name}=${c.value}`).join('; ');
    headers.set('cookie', cookieHeader);
  }

  // Debug: log if cookies are present for auth-related paths
  if (path.includes('/auths/') || path.includes('/events/') || path.includes('/platforms/')) {
    const hasCookies = !!headers.get('cookie');
    console.log(`[proxy] ${req.method} ${path} - forwarded cookies: ${hasCookies}`);
  }

  let backendRes: Response;
  try {
    // For simple JSON requests, we can read the body to avoid streaming issues
    // For large uploads and SSE, we keep the stream
    const contentType = req.headers.get('content-type') || '';
    let body: any = req.body;

    if (contentType.includes('application/json') && !['GET', 'HEAD'].includes(req.method)) {
      const text = await req.text();
      body = text;
      bodyText = text;
    }

    // Give the backend up to 45s to respond on non-GET requests. Render's
    // free tier can take 30+s to cold-start (the default undici connect
    // timeout is 10s which is too short for POSTs like /auth/stellar/connect).
    // GET requests (including SSE streams) keep the default timeout.
    const fetchTimeout = ['GET', 'HEAD'].includes(req.method)
      ? undefined
      : AbortSignal.timeout(45_000);

    backendRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
      // We manually forward cookies via the 'cookie' header in 'headers'
      // so we don't need fetch to try and manage credentials itself.
      duplex: 'half',
      ...(fetchTimeout ? { signal: fetchTimeout } : {}),
    } as RequestInit);
  } catch (err: any) {
    // ECONNRESET / ECONNREFUSED / ENOTFOUND = Render backend is waking up from sleep
    // (free tier spins down after 15 min of inactivity, takes ~30s to wake up;
    //  ENOTFOUND happens during cold-start before DNS propagates back to the node)
    // UND_ERR_CONNECT_TIMEOUT = undici connection timeout during wake-up
    // TimeoutError = AbortSignal.timeout() fired (45s) — backend still cold-starting
    const code = err?.cause?.code ?? err?.code ?? '';
    const msg  = err?.message ?? '';
    const name = err?.name ?? '';
    const isWakeUp =
      code === 'ECONNRESET'           ||
      code === 'ECONNREFUSED'         ||
      code === 'ETIMEDOUT'            ||
      code === 'ENOTFOUND'            ||
      code === 'UND_ERR_CONNECT_TIMEOUT' ||
      name === 'TimeoutError'         ||
      msg.includes('UND_ERR_CONNECT_TIMEOUT') ||
      msg.includes('aborted');

    console.error(
      `[proxy] ${req.method} ${path} → ${isWakeUp ? 'backend waking up' : 'connection error'}: ${code || msg}`
    );
    logApiRequest({
      method: req.method,
      path: req.nextUrl.pathname,
      status: 503,
      durationMs: Date.now() - startedAt,
    });

    return new NextResponse(
      JSON.stringify({
        statusCode: 503,
        message: isWakeUp
          ? 'Server is starting up — please wait a moment and try again.'
          : 'Could not reach the server.',
      }),
      {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }
    );
  }

  logApiRequest({
    method: req.method,
    path: req.nextUrl.pathname,
    status: backendRes.status,
    durationMs: Date.now() - startedAt,
    body: bodyText,
    logBody: shouldLogBody(req.nextUrl.pathname),
  });

  const responseHeaders = new Headers(backendRes.headers);
  // Remove encoding headers — no longer valid after Node's auto-decompression
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');

  // Fix Set-Cookie headers forwarded from the backend
  const setCookies = responseHeaders.getSetCookie();
  if (setCookies.length > 0) {
    responseHeaders.delete('set-cookie');
    setCookies.forEach(cookie => {
      // Normalise Path to / so the cookie is available to the entire app,
      // not just requests under /api/proxy/
      let newCookie = cookie.replace(/Path=\/[^;]*/g, 'Path=/');
      if (!newCookie.match(/Path=/i)) {
        newCookie += '; Path=/';
      }

      // Strip Domain so the cookie binds to the current host (important on localhost)
      newCookie = newCookie.replace(/;\s*Domain=[^;]+/gi, '');

      // Ensure SameSite=Lax if not already set
      if (!newCookie.match(/SameSite=/i)) {
        newCookie += '; SameSite=Lax';
      }

      if (process.env.NODE_ENV === 'production' && !newCookie.match(/Secure/i)) {
        newCookie += '; Secure';
      }

      responseHeaders.append('set-cookie', newCookie);
    });
  }

  // Log 4xx and 5xx errors for debugging
  if (backendRes.status >= 400) {
    backendRes.clone().text().then(body => {
      console.error(`[proxy] ${req.method} ${path} → ${backendRes.status}`);
      if (typeof body === 'string') {
        console.error('[proxy] backend error response:', body.slice(0, 500));
      }
    }).catch(() => {});
  }

  // SSE streams: configure headers for real-time delivery
  const isSSE = responseHeaders.get('content-type')?.includes('text/event-stream');
  if (isSSE) {
    console.log('[proxy] SSE stream detected — configuring for real-time delivery');
    responseHeaders.set('cache-control', 'no-cache');
    responseHeaders.set('x-accel-buffering', 'no');
    responseHeaders.set('connection', 'keep-alive');
  }

  const etag = await computeEtag(req, backendRes, responseHeaders, targetUrl);
  const ifNoneMatch = etag ? req.headers.get('if-none-match') : null;
  const etagMatches = !!etag && !!ifNoneMatch && ifNoneMatch
    .split(',')
    .map((v) => v.trim())
    .some((v) => v === etag || v === `W/${etag}`);

  if (etag && etagMatches) {
    // Issue #1394 — 304 Not Modified: the client already holds this representation.
    return new NextResponse(null, {
      status: 304,
      headers: {
        etag,
        'cache-control': responseHeaders.get('cache-control') || 'no-cache',
      },
    });
  }

  return new NextResponse(backendRes.body, {
    status: backendRes.status,
    headers: responseHeaders,
  });
}

export const GET     = handler;
export const POST    = handler;
export const PUT     = handler;
export const PATCH   = handler;
export const DELETE  = handler;
export const OPTIONS = handler;

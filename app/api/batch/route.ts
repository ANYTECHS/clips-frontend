import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { checkCsrf } from "@/app/lib/csrf";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { getEndpointRateLimit } from "@/app/lib/endpointRateLimits";
import { batchRequestSchema } from "../schemas/index";
import type { ApiResponse } from "../types";
import type { BatchResponseItem } from "../schemas/batch.schema";

type RouteHandler = (req: NextRequest, ctx?: { params?: Promise<Record<string, string>> }) => Promise<NextResponse>;

interface RouteEntry {
  pattern: RegExp;
  paramNames: string[];
  handlers: Partial<Record<string, RouteHandler>>;
}

async function buildRouteRegistry(): Promise<RouteEntry[]> {
  const clipsRoute = await import("@/app/api/clips/route");
  const projectsRoute = await import("@/app/api/projects/route");
  const dashboardRoute = await import("@/app/api/dashboard/route");
  const notificationsRoute = await import("@/app/api/notifications/route");
  const earningsRoute = await import("@/app/api/earnings/route");
  const userRoute = await import("@/app/api/user/route");

  return [
    {
      pattern: /^\/api\/clips$/,
      paramNames: [],
      handlers: { GET: clipsRoute.GET, DELETE: clipsRoute.DELETE },
    },
    {
      pattern: /^\/api\/projects$/,
      paramNames: [],
      handlers: { GET: projectsRoute.GET },
    },
    {
      pattern: /^\/api\/dashboard$/,
      paramNames: [],
      handlers: { GET: dashboardRoute.GET },
    },
    {
      pattern: /^\/api\/notifications$/,
      paramNames: [],
      handlers: { GET: notificationsRoute.GET },
    },
    {
      pattern: /^\/api\/earnings$/,
      paramNames: [],
      handlers: { GET: earningsRoute.GET },
    },
    {
      pattern: /^\/api\/user$/,
      paramNames: [],
      handlers: { GET: userRoute.GET },
    },
  ];
}

function resolveRoute(
  registry: RouteEntry[],
  method: string,
  path: string
): { handler: RouteHandler; params: Record<string, string> } | null {
  const [pathname] = path.split("?");
  for (const entry of registry) {
    const match = pathname.match(entry.pattern);
    if (match) {
      const handler = entry.handlers[method];
      if (!handler) return null;
      const params: Record<string, string> = {};
      entry.paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      return { handler, params };
    }
  }
  return null;
}

function buildInternalRequest(
  method: string,
  path: string,
  body: unknown,
  originalHeaders: Headers
): NextRequest {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const url = new URL(path, baseUrl);

  const headers = new Headers();
  const cookie = originalHeaders.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const auth = originalHeaders.get("authorization");
  if (auth) headers.set("authorization", auth);
  headers.set("content-type", "application/json");

  const init: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined && method !== "GET") {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(url.toString(), init);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" } satisfies ApiResponse<null>,
      { status: 401 }
    );
  }

  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const rateLimited = await applyRateLimit(request, getEndpointRateLimit("/api/batch"));
  if (rateLimited) return rateLimited;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: "Invalid JSON body" } satisfies ApiResponse<null>,
      { status: 400 }
    );
  }

  const parsed = batchRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: "Validation failed",
        issues: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const registry = await buildRouteRegistry();

  const results = await Promise.all(
    parsed.data.requests.map(async (item): Promise<BatchResponseItem> => {
      const resolved = resolveRoute(registry, item.method, item.path);

      if (!resolved) {
        return {
          status: 400,
          body: { data: null, error: `Unsupported batch path or method: ${item.method} ${item.path}` },
        };
      }

      try {
        const internalReq = buildInternalRequest(item.method, item.path, item.body, request.headers);
        const ctx = Object.keys(resolved.params).length > 0
          ? { params: Promise.resolve(resolved.params) }
          : undefined;
        const response = await resolved.handler(internalReq, ctx);
        const responseBody = await response.json().catch(() => null);
        return { status: response.status, body: responseBody };
      } catch {
        return {
          status: 500,
          body: { data: null, error: "Internal batch request error" },
        };
      }
    })
  );

  const body: ApiResponse<BatchResponseItem[]> = {
    data: results,
    error: null,
  };

  return NextResponse.json(body);
}

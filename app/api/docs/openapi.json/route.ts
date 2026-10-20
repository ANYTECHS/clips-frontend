/**
 * GET /api/docs/openapi.json — Issue #896
 *
 * Serves the OpenAPI 3.1 specification as JSON.
 * No authentication required — this is a public documentation endpoint.
 *
 * Consumers:
 *   - Swagger UI at GET /api/docs
 *   - Any OpenAPI-compatible tooling (Postman, Insomnia, code generators, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import { openApiSpec, versionedOpenApiSpecs } from "../openapi";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestedVersion = request.nextUrl.searchParams.get("version");
  const spec = requestedVersion
    ? versionedOpenApiSpecs[requestedVersion as keyof typeof versionedOpenApiSpecs]
    : openApiSpec;

  if (!spec) {
    return NextResponse.json(
      { error: "Unsupported OpenAPI version. Choose v1 or v2." },
      { status: 400 },
    );
  }

  return NextResponse.json(spec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
    },
  });
}

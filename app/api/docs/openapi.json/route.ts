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

import { NextResponse } from "next/server";
import { openApiSpec } from "../openapi";

export const dynamic = "force-static";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(openApiSpec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
    },
  });
}

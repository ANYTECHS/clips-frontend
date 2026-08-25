/**
 * GET /api/docs — Issue #896
 *
 * Interactive Swagger UI for the ClipCash API.
 *
 * Served at /api/docs — renders an HTML page that loads Swagger UI from a CDN
 * and points it at /api/docs/openapi.json.
 *
 * No authentication required.
 * In production the page is publicly accessible; the OpenAPI spec itself
 * contains no secrets.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-static";

const html = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ClipCash API Docs</title>
  <meta name="robots" content="noindex" />
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #0a0a0a; }
    .swagger-ui { font-family: inherit; }
    .swagger-ui .topbar { background: #111; padding: 8px 16px; }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function () {
      SwaggerUIBundle({
        url: "/api/docs/openapi.json",
        dom_id: "#swagger-ui",
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
        layout: "BaseLayout",
        deepLinking: true,
        displayRequestDuration: true,
        tryItOutEnabled: true,
        filter: true,
        persistAuthorization: true,
      });
    };
  </script>
</body>
</html>`;

export async function GET(): Promise<NextResponse> {
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      "X-Robots-Tag": "noindex",
    },
  });
}

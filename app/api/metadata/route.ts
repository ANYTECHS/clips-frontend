/**
 * app/api/metadata/route.ts
 *
 * GET /api/metadata — Machine-readable API discovery & metadata endpoint.
 *
 * Exposes API identification, current/supported versions, capability discovery,
 * and public endpoint descriptors.
 *
 * Issue #985 – Add API metadata endpoints.
 */

import { NextRequest } from "next/server";
import { success } from "@/app/api/apiResponse";
import { withVersioning, CURRENT_VERSION, SUPPORTED_VERSIONS } from "@/app/api/versioning";
import { ApiMetadataSchema } from "@/app/api/schemas";

export async function GET(request: NextRequest) {
  return withVersioning(request, (version) => {
    const payload = {
      name: "ClipCash API",
      description:
        "Public API for ClipCash short-form video clip extraction, earnings tracking, and wallet management.",
      version,
      supportedVersions: SUPPORTED_VERSIONS,
      latestVersion: CURRENT_VERSION,
      documentationUrl: "/docs/api-versioning.md",
      capabilities: {
        upload: {
          enabled: true,
          maxFileSizeMb: 500,
          supportedCodecs: ["mp4", "mov", "webm", "avi"],
        },
        earnings: {
          enabled: true,
          exportFormats: ["csv", "json"],
        },
        wallet: {
          enabled: true,
          supportedChains: ["stellar", "soroban"],
        },
        passkey: {
          enabled: true,
        },
        transform: {
          enabled: true,
          maxBatchSize: 10,
        },
        versioning: {
          enabled: true,
          negotiationMethods: ["path", "header", "query"],
        },
      },
      endpoints: [
        {
          path: "/api/metadata",
          method: "GET",
          description: "API capability discovery and service metadata",
          version: "v1",
        },
        {
          path: "/api/upload",
          method: "POST",
          description: "Upload raw video files for clip extraction",
          version: "v1",
        },
        {
          path: "/api/earnings/transactions",
          method: "GET",
          description: "List creator earnings transactions with filtering and pagination",
          version: "v1",
        },
        {
          path: "/api/user/passkey",
          method: "POST",
          description: "Authenticate passkey and manage smart wallet registration",
          version: "v1",
        },
        {
          path: "/api/dashboard",
          method: "GET",
          description: "Creator dashboard summary metrics and statistics",
          version: "v1",
        },
        {
          path: "/api/transform",
          method: "POST",
          description: "Batch transform video content for multiple social platforms",
          version: "v1",
        },
      ],
    };

    // Validate payload against schema to guarantee response contract
    const parsed = ApiMetadataSchema.parse(payload);
    return success(parsed);
  });
}

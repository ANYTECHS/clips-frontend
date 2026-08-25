/**
 * app/api/lib/index.ts
 *
 * Barrel re-export for all shared API infrastructure:
 *   - withApiMiddleware / ApiError  (#893 auth middleware, #895 error middleware)
 *   - getEndpointRateLimit          (#892 per-endpoint rate limiting)
 *   - compressResponse / decompressRequestBody (#897 compression)
 *
 * Import from this single entry point in route handlers:
 *
 *   import {
 *     withApiMiddleware,
 *     ApiError,
 *     getEndpointRateLimit,
 *     compressResponse,
 *   } from "@/app/api/lib";
 */

export {
  withApiMiddleware,
  ApiError,
  errorResponse,
  type ApiContext,
  type ApiHandler,
  type AuthContext,
  type MiddlewareOptions,
  type FormattedError,
  type ApiErrorCode,
} from "@/app/lib/apiMiddleware";

export {
  getEndpointRateLimit,
  getAllEndpointRateLimits,
  DEFAULT_RATE_LIMIT,
  type EndpointRateLimit,
} from "@/app/lib/endpointRateLimits";

export {
  compressResponse,
  decompressRequestBody,
  type CompressionConfig,
  type DecompressResult,
} from "@/app/lib/apiCompression";

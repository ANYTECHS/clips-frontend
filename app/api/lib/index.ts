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
  DEFAULT_API_TIMEOUT_MS,
  type ApiContext,
  type ApiHandler,
  type AuthContext,
  type MiddlewareOptions,
  type FormattedError,
  type ApiErrorCode,
} from "@/app/lib/apiMiddleware";

export {
  ERROR_CODE_STATUS,
  errorCodeForStatus,
  normalizeErrorCode,
} from "@/app/api/errorCodes";

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

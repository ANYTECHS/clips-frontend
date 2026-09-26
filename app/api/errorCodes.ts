import type { ErrorCode } from "./types";

export const ERROR_CODE_STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  SESSION_EXPIRED: 401,
  VALIDATION_ERROR: 400,
  INVALID_INPUT: 400,
  MISSING_REQUIRED_FIELD: 400,
  NOT_FOUND: 404,
  ALREADY_EXISTS: 409,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  TIMEOUT: 504,
  UPSTREAM_ERROR: 502,
  JOB_NOT_FOUND: 404,
  JOB_FORBIDDEN: 403,
  JOB_DISPATCH_FAILED: 502,
  FILE_TOO_LARGE: 413,
  INVALID_FILE_TYPE: 415,
  VIRUS_DETECTED: 422,
  STORAGE_ERROR: 503,
  WALLET_NOT_FOUND: 404,
  MINT_FAILED: 502,
  INSUFFICIENT_BALANCE: 422,
};

/** Legacy route codes mapped to the public API vocabulary. */
const LEGACY_ERROR_CODES: Record<string, ErrorCode> = {
  BAD_REQUEST: "INVALID_INPUT",
  INVALID_PARAM: "INVALID_INPUT",
  VALIDATION_FAILED: "VALIDATION_ERROR",
  NO_FILES: "MISSING_REQUIRED_FIELD",
  STORAGE_NOT_CONFIGURED: "SERVICE_UNAVAILABLE",
  UPLOAD_INTERNAL_ERROR: "INTERNAL_ERROR",
  SECURITY_SCAN_FAILED: "VIRUS_DETECTED",
  CLIP_NOT_FOUND: "NOT_FOUND",
  VERSION_RETIRED: "SERVICE_UNAVAILABLE",
};

export function normalizeErrorCode(code: string | undefined): ErrorCode {
  if (code && code in ERROR_CODE_STATUS) return code as ErrorCode;
  return (code && LEGACY_ERROR_CODES[code]) || "INTERNAL_ERROR";
}

export function errorCodeForStatus(status: number): ErrorCode {
  switch (status) {
    case 400: return "INVALID_INPUT";
    case 401: return "UNAUTHORIZED";
    case 403: return "FORBIDDEN";
    case 404: return "NOT_FOUND";
    case 409: return "CONFLICT";
    case 413: return "FILE_TOO_LARGE";
    case 415: return "INVALID_FILE_TYPE";
    case 422: return "INVALID_INPUT";
    case 429: return "RATE_LIMITED";
    case 502: return "UPSTREAM_ERROR";
    case 503: return "SERVICE_UNAVAILABLE";
    case 504: return "TIMEOUT";
    default: return "INTERNAL_ERROR";
  }
}
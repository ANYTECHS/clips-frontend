// Machine-readable error codes returned in the `code` field of every API error
// response (issue #1249). Clients should branch on `code`, never on `message`.

export const ERROR_CODES = {
  /** Malformed request (missing/invalid parameter). */
  BAD_REQUEST: "BAD_REQUEST",
  /** Request failed schema/field validation — see `details`. */
  VALIDATION_ERROR: "VALIDATION_ERROR",
  /** Authentication is required or the session is invalid. */
  AUTH_REQUIRED: "AUTH_REQUIRED",
  /** Authenticated but not allowed to perform this action. */
  FORBIDDEN: "FORBIDDEN",
  /** Cross-origin request from an origin outside the allowlist. */
  ORIGIN_NOT_ALLOWED: "ORIGIN_NOT_ALLOWED",
  /** Resource does not exist or is unavailable. */
  NOT_FOUND: "NOT_FOUND",
  /** Uploaded/streamed content is too large. */
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  /** Content type is not accepted by this route. */
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
  /** Too many requests — retry later. */
  RATE_LIMITED: "RATE_LIMITED",
  /** Unhandled server-side failure. */
  INTERNAL_ERROR: "INTERNAL_ERROR",
  /** An upstream service (backend, CDN, storage) failed or returned an error. */
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
  /** Service temporarily unavailable (e.g. backend cold-starting). */
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Default error code for an HTTP status when a route does not pass one. */
export function codeForStatus(status: number): ErrorCode {
  switch (status) {
    case 400:
      return ERROR_CODES.BAD_REQUEST;
    case 401:
      return ERROR_CODES.AUTH_REQUIRED;
    case 403:
      return ERROR_CODES.FORBIDDEN;
    case 404:
      return ERROR_CODES.NOT_FOUND;
    case 413:
      return ERROR_CODES.PAYLOAD_TOO_LARGE;
    case 415:
      return ERROR_CODES.UNSUPPORTED_MEDIA_TYPE;
    case 422:
      return ERROR_CODES.VALIDATION_ERROR;
    case 429:
      return ERROR_CODES.RATE_LIMITED;
    case 502:
    case 504:
      return ERROR_CODES.UPSTREAM_ERROR;
    case 503:
      return ERROR_CODES.SERVICE_UNAVAILABLE;
    default:
      return status >= 500 ? ERROR_CODES.INTERNAL_ERROR : ERROR_CODES.BAD_REQUEST;
  }
}

/**
 * @jest-environment node
 */
import {
  ERROR_CODE_STATUS,
  errorCodeForStatus,
  normalizeErrorCode,
} from "@/app/api/errorCodes";

jest.mock("@/app/lib/auth", () => ({
  auth: jest.fn(),
}));

import { classifyError } from "@/app/lib/apiMiddleware";

describe("API error code standard", () => {
  it("maps every public error code to an HTTP status", () => {
    expect(Object.keys(ERROR_CODE_STATUS)).toHaveLength(24);
    expect(ERROR_CODE_STATUS.TIMEOUT).toBe(504);
    expect(ERROR_CODE_STATUS.FILE_TOO_LARGE).toBe(413);
  });

  it("normalizes legacy route codes", () => {
    expect(normalizeErrorCode("INVALID_PARAM")).toBe("INVALID_INPUT");
    expect(normalizeErrorCode("NO_FILES")).toBe("MISSING_REQUIRED_FIELD");
    expect(normalizeErrorCode("unknown-code")).toBe("INTERNAL_ERROR");
  });

  it("maps statuses to stable fallback codes", () => {
    expect(errorCodeForStatus(401)).toBe("UNAUTHORIZED");
    expect(errorCodeForStatus(502)).toBe("UPSTREAM_ERROR");
    expect(errorCodeForStatus(599)).toBe("INTERNAL_ERROR");
  });

  it("returns the standard envelope for classified errors", () => {
    const result = classifyError(new SyntaxError("bad json"));
    expect(result).toMatchObject({
      status: 400,
      body: {
        data: null,
        error: "Invalid JSON",
        code: "INVALID_INPUT",
        meta: { timestamp: expect.any(String) },
      },
    });
  });
});

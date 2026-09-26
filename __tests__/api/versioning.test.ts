/**
 * @jest-environment node
 */

/**
 * __tests__/api/versioning.test.ts
 *
 * Unit and integration tests for API Version Negotiation (#984).
 */

import {
  negotiateVersion,
  resolveVersion,
  withVersioning,
  rejectUnsupportedVersion,
  SUPPORTED_VERSIONS,
  DEFAULT_VERSION,
} from "@/app/api/versioning";
import { NextRequest, NextResponse } from "next/server";

describe("API Version Negotiation (#984)", () => {
  describe("negotiateVersion", () => {
    it("resolves supported version from URL path prefix", () => {
      const req = new NextRequest("http://localhost:3000/api/v1/projects");
      const result = negotiateVersion(req);
      expect(result).toEqual({ status: "success", version: "v1" });
    });

    it("resolves supported version from X-API-Version header", () => {
      const req = new NextRequest("http://localhost:3000/api/projects", {
        headers: { "x-api-version": "v2" },
      });
      const result = negotiateVersion(req);
      expect(result).toEqual({ status: "success", version: "v2" });
    });

    it("resolves supported version from Accept-Version header", () => {
      const req = new NextRequest("http://localhost:3000/api/projects", {
        headers: { "accept-version": "v1" },
      });
      const result = negotiateVersion(req);
      expect(result).toEqual({ status: "success", version: "v1" });
    });

    it("resolves supported version from api-version query param", () => {
      const req = new NextRequest("http://localhost:3000/api/projects?api-version=v2");
      const result = negotiateVersion(req);
      expect(result).toEqual({ status: "success", version: "v2" });
    });

    it("defaults to DEFAULT_VERSION (v1) when no version is specified", () => {
      const req = new NextRequest("http://localhost:3000/api/projects");
      const result = negotiateVersion(req);
      expect(result).toEqual({ status: "success", version: DEFAULT_VERSION });
    });

    it("detects explicit unsupported version (e.g. v99)", () => {
      const req = new NextRequest("http://localhost:3000/api/v99/projects");
      const result = negotiateVersion(req);
      expect(result).toEqual({ status: "unsupported", requestedVersion: "v99" });
    });

    it("detects explicit unsupported version in header", () => {
      const req = new NextRequest("http://localhost:3000/api/projects", {
        headers: { "x-api-version": "invalid-ver" },
      });
      const result = negotiateVersion(req);
      expect(result).toEqual({ status: "unsupported", requestedVersion: "invalid-ver" });
    });
  });

  describe("withVersioning middleware helper", () => {
    it("handles supported request and attaches version headers", async () => {
      const req = new NextRequest("http://localhost:3000/api/dashboard", {
        headers: { "x-api-version": "v1" },
      });

      const res = await withVersioning(req, (version) => {
        return NextResponse.json({ data: `Handled by ${version}` });
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("API-Version")).toBe("v1");
      expect(res.headers.get("X-API-Latest")).toBe("v1");
      const body = await res.json();
      expect(body.data).toBe("Handled by v1");
    });

    it("rejects unsupported versions with 400 Bad Request and UNSUPPORTED_API_VERSION code", async () => {
      const req = new NextRequest("http://localhost:3000/api/dashboard", {
        headers: { "x-api-version": "v99" },
      });

      const handler = jest.fn();
      const res = await withVersioning(req, handler);

      expect(handler).not.toHaveBeenCalled();
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.code).toBe("UNSUPPORTED_API_VERSION");
      expect(json.error).toContain("Unsupported API version 'v99'");
      expect(json.meta.supportedVersions).toEqual(SUPPORTED_VERSIONS);
    });

    it("serves default version for versionless requests", async () => {
      const req = new NextRequest("http://localhost:3000/api/dashboard");

      const res = await withVersioning(req, (version) => {
        return NextResponse.json({ data: "OK", version });
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.version).toBe("v1");
      expect(res.headers.get("API-Version")).toBe("v1");
    });
  });
});

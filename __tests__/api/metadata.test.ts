/**
 * @jest-environment node
 */

/**
 * __tests__/api/metadata.test.ts
 *
 * Integration and unit tests for API Metadata Endpoints (#985).
 */

import { GET } from "@/app/api/metadata/route";
import { NextRequest } from "next/server";
import { ApiMetadataSchema } from "@/app/api/schemas";

describe("GET /api/metadata (#985)", () => {
  it("returns 200 OK with valid API metadata", async () => {
    const req = new NextRequest("http://localhost:3000/api/metadata");
    const res = await GET(req);

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.error).toBeNull();
    expect(json.data).toBeDefined();

    // Verify response conforms to ApiMetadataSchema
    const parseResult = ApiMetadataSchema.safeParse(json.data);
    expect(parseResult.success).toBe(true);

    expect(json.data.name).toBe("ClipCash API");
    expect(json.data.version).toBe("v1");
    expect(json.data.supportedVersions).toContain("v1");
    expect(json.data.capabilities).toBeDefined();
    expect(json.data.capabilities.upload.enabled).toBe(true);
    expect(json.data.capabilities.versioning.enabled).toBe(true);
    expect(Array.isArray(json.data.endpoints)).toBe(true);
  });

  it("attaches version response headers", async () => {
    const req = new NextRequest("http://localhost:3000/api/metadata");
    const res = await GET(req);

    expect(res.headers.get("API-Version")).toBe("v1");
    expect(res.headers.get("X-API-Latest")).toBe("v1");
  });

  it("does not expose secrets, credentials, or internal operational details", async () => {
    const req = new NextRequest("http://localhost:3000/api/metadata");
    const res = await GET(req);

    const text = await res.text();

    expect(text).not.toContain("SECRET");
    expect(text).not.toContain("PASSWORD");
    expect(text).not.toContain("DATABASE_URL");
    expect(text).not.toContain("PRIVATE_KEY");
  });
});

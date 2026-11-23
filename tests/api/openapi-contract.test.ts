// Issue #1389 — contract tests: docs/openapi.yaml must match the real route
// handlers under app/api/**.
//
//  1. Every route file / exported HTTP method is documented in the spec, and
//     every documented operation has a route handler (no drift either way).
//  2. Every documented operation has at least one contract case below, whose
//     real response (status, headers, content type, JSON body) must match the
//     spec. Adding an endpoint without a case fails the suite.
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";
import { load } from "js-yaml";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// Route handlers that forward cookies call next/headers' cookies(), which only
// works inside a Next.js request scope.
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [] }),
}));

type Json = any;

const ROOT = join(__dirname, "..", "..");
const API_DIR = join(ROOT, "app", "api");
const SPEC_PATH = join(ROOT, "docs", "openapi.yaml");
const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "options", "head"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

const spec = load(readFileSync(SPEC_PATH, "utf8")) as Json;

// ── Spec helpers ─────────────────────────────────────────────────────────────

function resolveRef(node: Json): Json {
  let current = node;
  while (current && typeof current === "object" && typeof current.$ref === "string") {
    const ref: string = current.$ref;
    if (!ref.startsWith("#/")) throw new Error(`Only local $refs are supported: ${ref}`);
    current = ref
      .slice(2)
      .split("/")
      .reduce((acc: Json, key) => acc?.[key.replace(/~1/g, "/").replace(/~0/g, "~")], spec);
    if (current === undefined) throw new Error(`Unresolvable $ref: ${ref}`);
  }
  return current;
}

/** Minimal JSON-schema (OpenAPI 3.0 subset) validator. Returns error strings. */
function validate(schemaNode: Json, value: unknown, path = "$"): string[] {
  const schema = resolveRef(schemaNode);
  if (!schema || typeof schema !== "object") return [];

  if (value === null) {
    return schema.nullable ? [] : [`${path}: null is not allowed`];
  }

  const errors: string[] = [];
  switch (schema.type) {
    case "object": {
      if (typeof value !== "object" || Array.isArray(value)) return [`${path}: expected object`];
      const obj = value as Record<string, unknown>;
      for (const key of schema.required ?? []) {
        if (!(key in obj)) errors.push(`${path}.${key}: is required`);
      }
      const props = schema.properties ?? {};
      for (const [key, sub] of Object.entries(props)) {
        if (key in obj && obj[key] !== undefined) errors.push(...validate(sub, obj[key], `${path}.${key}`));
      }
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(obj)) {
          if (!(key in props)) errors.push(`${path}.${key}: is not allowed by the spec`);
        }
      }
      break;
    }
    case "array":
      if (!Array.isArray(value)) return [`${path}: expected array`];
      if (schema.items) value.forEach((item, i) => errors.push(...validate(schema.items, item, `${path}[${i}]`)));
      break;
    case "string":
      if (typeof value !== "string") return [`${path}: expected string`];
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: does not match ${schema.pattern}`);
      break;
    case "integer":
      if (!Number.isInteger(value)) return [`${path}: expected integer`];
      break;
    case "number":
      if (typeof value !== "number") return [`${path}: expected number`];
      break;
    case "boolean":
      if (typeof value !== "boolean") return [`${path}: expected boolean`];
      break;
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push(`${path}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`);
  }
  return errors;
}

function getOperation(specPath: string, method: HttpMethod): Json {
  return spec.paths?.[specPath]?.[method];
}

function findResponseSpec(operation: Json, status: number): Json | undefined {
  const responses = operation?.responses ?? {};
  const node =
    responses[String(status)] ??
    responses[`${String(status)[0]}XX`] ??
    responses.default;
  return node ? resolveRef(node) : undefined;
}

function mediaTypeMatches(pattern: string, actual: string): boolean {
  if (pattern === actual) return true;
  if (pattern.endsWith("/*")) return actual.startsWith(pattern.slice(0, -1));
  return pattern === "*/*";
}

async function assertMatchesSpec(
  specPath: string,
  method: HttpMethod,
  res: Response,
): Promise<void> {
  const label = `${method.toUpperCase()} ${specPath} → ${res.status}`;
  const operation = getOperation(specPath, method);
  expect(operation, `${label}: operation missing from spec`).toBeTruthy();

  const responseSpec = findResponseSpec(operation, res.status);
  expect(responseSpec, `${label}: status not documented in spec`).toBeTruthy();

  for (const [name, headerNode] of Object.entries<Json>(responseSpec.headers ?? {})) {
    const header = resolveRef(headerNode);
    if (header.required) {
      expect(res.headers.get(name), `${label}: missing required header ${name}`).toBeTruthy();
    }
  }

  const content = responseSpec.content;
  if (!content) return;

  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  const mediaKey = Object.keys(content).find((key) => mediaTypeMatches(key, contentType));
  expect(mediaKey, `${label}: content-type "${contentType}" not documented`).toBeTruthy();

  const schema = content[mediaKey!].schema;
  if (schema && contentType.includes("json")) {
    const body = await res.json();
    expect(validate(schema, body), `${label}: body does not match spec`).toEqual([]);
  }
}

// ── Route discovery ──────────────────────────────────────────────────────────

interface RouteFile {
  file: string;
  specPath: string;
}

function findRoutes(dir: string): RouteFile[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return findRoutes(full);
    if (!/^route\.(ts|tsx|js)$/.test(entry)) return [];
    const segments = relative(join(ROOT, "app"), dir)
      .split(sep)
      .map((seg) => seg.replace(/^\[\[?(?:\.\.\.)?([^\]]+)\]\]?$/, "{$1}"));
    return [{ file: full, specPath: `/${segments.join("/")}` }];
  });
}

const routes = findRoutes(API_DIR);

async function exportedMethods(file: string): Promise<HttpMethod[]> {
  const mod = await import(file);
  return HTTP_METHODS.filter((m) => typeof mod[m.toUpperCase()] === "function");
}

async function loadHandler(specPath: string, method: HttpMethod) {
  const route = routes.find((r) => r.specPath === specPath);
  if (!route) throw new Error(`No route file for ${specPath}`);
  const mod = await import(route.file);
  const handler = mod[method.toUpperCase()];
  if (typeof handler !== "function") throw new Error(`${route.file} does not export ${method.toUpperCase()}`);
  return handler as (req: NextRequest) => Promise<Response>;
}

// ── Contract cases (at least one per documented operation) ───────────────────

interface ContractCase {
  name: string;
  specPath: string;
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  setup?: () => void;
  expectStatus: number;
}

const BASE = "http://localhost:3000";
const PROXY_METHODS: HttpMethod[] = ["get", "post", "put", "patch", "delete", "options"];

const CASES: ContractCase[] = [
  {
    name: "rejects a missing url",
    specPath: "/api/download",
    method: "get",
    url: `${BASE}/api/download`,
    expectStatus: 400,
  },
  {
    name: "rejects a non-Cloudinary url",
    specPath: "/api/download",
    method: "get",
    url: `${BASE}/api/download?url=${encodeURIComponent("https://evil.example.com/a.mp4")}`,
    expectStatus: 400,
  },
  {
    name: "rejects a missing url",
    specPath: "/api/youtube-dl",
    method: "get",
    url: `${BASE}/api/youtube-dl`,
    expectStatus: 400,
  },
  {
    name: "rejects an invalid videoId",
    specPath: "/api/youtube-info",
    method: "get",
    url: `${BASE}/api/youtube-info?videoId=bad`,
    expectStatus: 400,
  },
  {
    name: "rejects a missing upload url",
    specPath: "/api/r2-proxy",
    method: "put",
    url: `${BASE}/api/r2-proxy`,
    expectStatus: 400,
  },
  {
    name: "rejects a non-R2 upload url",
    specPath: "/api/r2-proxy",
    method: "put",
    url: `${BASE}/api/r2-proxy?url=${encodeURIComponent("https://evil.example.com/upload")}`,
    expectStatus: 403,
  },
  {
    name: "reports healthy when the backend is up",
    specPath: "/api/health/deep",
    method: "get",
    url: `${BASE}/api/health/deep`,
    setup: () => vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 }))),
    expectStatus: 200,
  },
  {
    name: "reports degraded when the backend is down",
    specPath: "/api/health/deep",
    method: "get",
    url: `${BASE}/api/health/deep`,
    setup: () => vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 500 }))),
    expectStatus: 503,
  },
  ...PROXY_METHODS.map<ContractCase>((method) => ({
    name: "rejects a disallowed origin",
    specPath: "/api/proxy/{path}",
    method,
    url: `${BASE}/api/proxy/users/me`,
    headers: { origin: "https://evil.example.com" },
    expectStatus: 403,
  })),
  {
    name: "streams an error event when the backend is unreachable",
    specPath: "/api/sse/{path}",
    method: "get",
    url: `${BASE}/api/sse/events/processing-progress/abc`,
    setup: () =>
      vi.stubGlobal("fetch", vi.fn(async () => {
        throw new Error("connect ECONNREFUSED");
      })),
    expectStatus: 200,
  },
];

// ── Tests ────────────────────────────────────────────────────────────────────

describe("docs/openapi.yaml", () => {
  it("is an OpenAPI 3 document with paths", () => {
    expect(String(spec.openapi)).toMatch(/^3\./);
    expect(Object.keys(spec.paths ?? {}).length).toBeGreaterThan(0);
  });

  it("documents every route file", () => {
    const documented = Object.keys(spec.paths);
    for (const route of routes) {
      expect(documented, `${relative(ROOT, route.file)} is not documented as ${route.specPath}`)
        .toContain(route.specPath);
    }
  });

  it("has no paths without a route file", () => {
    const implemented = routes.map((r) => r.specPath);
    for (const specPath of Object.keys(spec.paths)) {
      expect(implemented, `${specPath} is documented but has no route handler`).toContain(specPath);
    }
  });

  it("documents exactly the HTTP methods each route exports", async () => {
    for (const route of routes) {
      const exported = await exportedMethods(route.file);
      const documented = HTTP_METHODS.filter((m) => spec.paths[route.specPath]?.[m]);
      expect(documented, `${route.specPath}: spec methods differ from exported handlers`)
        .toEqual(exported);
    }
  });

  it("has at least one contract case per documented operation", () => {
    for (const [specPath, item] of Object.entries<Json>(spec.paths)) {
      for (const method of HTTP_METHODS) {
        if (!item[method]) continue;
        const covered = CASES.some((c) => c.specPath === specPath && c.method === method);
        expect(covered, `${method.toUpperCase()} ${specPath} has no contract case`).toBe(true);
      }
    }
  });
});

describe("route responses match docs/openapi.yaml", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  for (const c of CASES) {
    it(`${c.method.toUpperCase()} ${c.specPath} ${c.name}`, async () => {
      c.setup?.();
      const handler = await loadHandler(c.specPath, c.method);
      const res = await handler(
        new NextRequest(c.url, { method: c.method.toUpperCase(), headers: c.headers }),
      );
      expect(res.status).toBe(c.expectStatus);
      await assertMatchesSpec(c.specPath, c.method, res);
    });
  }
});

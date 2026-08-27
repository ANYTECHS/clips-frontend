# API Versioning Guide

## Overview

ClipCash API uses a **path-prefix versioning** strategy. The current stable version is **v1**.

Un-prefixed routes (`/api/upload`) resolve to the default version (v1) so all existing clients continue to work without modification.

---

## Version Resolution Order

When a request arrives, the version is resolved from:

1. **URL path prefix** — `/api/v1/…`, `/api/v2/…`
2. **`X-API-Version` request header** — `"v1"`, `"v2"`
3. **`api-version` query param** — `?api-version=v1`
4. **Default** — falls back to `v1`

---

## Response Headers

Every API response includes:

| Header | Value | Meaning |
|---|---|---|
| `API-Version` | `v1` | The version that handled the request |
| `X-API-Latest` | `v1` | Current stable version |
| `Deprecation` | `true` | Only set when the version is deprecated |
| `Sunset` | ISO date | Only set when a deprecation sunset date is known |
| `Deprecation-Notice` | string | Human-readable deprecation note |
| `Link` | `</api/v1>; rel="successor-version"` | Only when deprecated |

---

## Version Lifecycle

```
CURRENT → DEPRECATED (≥6 months notice) → RETIRED (410 Gone)
```

- **CURRENT** — fully supported, no warnings.
- **DEPRECATED** — still works but clients receive `Deprecation: true` and `Sunset` headers. Clients should migrate before the sunset date.
- **RETIRED** — returns `410 Gone` immediately. Clients must migrate.

---

## Current Versions

| Version | Status | Sunset Date | Notes |
|---|---|---|---|
| `v1` | CURRENT | — | Default version |
| `v2` | CURRENT | — | Reserved for next major release |

---

## Migration Guide: v1 → v2

> v2 is not yet released. This section will be updated when v2 is finalised.

When v2 is released, the following breaking changes are planned:

- Pagination shape will change from `{ page, pageSize, total }` to cursor-based
- `trendLabel` will be removed (use `totalTrend` directly)
- Error responses will include a machine-readable `code` field on all errors

---

## Implementing Versioning in a New Route

Use the `withVersioning` helper from `app/api/versioning.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { withVersioning } from "@/app/api/versioning";

export async function GET(request: NextRequest) {
  return withVersioning(request, (version) => {
    // version is "v1" | "v2"
    const data = version === "v2" ? newShape() : legacyShape();
    return NextResponse.json({ data, error: null });
  });
}
```

If you need manual control:

```ts
import { resolveVersion, rejectRetiredVersion, addVersionHeaders } from "@/app/api/versioning";

export async function GET(request: NextRequest) {
  const version = resolveVersion(request);
  const gone = rejectRetiredVersion(version);
  if (gone) return gone;

  const response = NextResponse.json({ data: "…", error: null });
  return addVersionHeaders(response, version);
}
```

---

## Deprecating a Version

1. Change the version status to `"deprecated"` in `VERSION_REGISTRY` inside `app/api/versioning.ts`.
2. Set a `sunsetDate` (ISO string) giving consumers at least **6 months** notice.
3. Add a `deprecationNote` explaining how to migrate.
4. Update the version table in this document.

```ts
const VERSION_REGISTRY: Record<ApiVersion, VersionMeta> = {
  v1: {
    status: "deprecated",
    sunsetDate: "2027-03-01",
    deprecationNote: "Migrate to v2. See /docs/api-versioning.md.",
  },
  v2: { status: "current" },
};
```

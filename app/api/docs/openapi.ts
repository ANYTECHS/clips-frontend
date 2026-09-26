/**
 * openapi.ts — Issue #896
 *
 * Canonical OpenAPI 3.1 specification for the ClipCash API.
 *
 * This file is the single source of truth for the spec. It is served at
 * GET /api/docs/openapi.json and consumed by the Swagger UI at GET /api/docs.
 *
 * Adding a new endpoint:
 *   1. Add a path entry under `paths`.
 *   2. Reference (or add) schemas in `components.schemas`.
 *   3. The spec is served live — no build step required.
 */

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "ClipCash API",
    version: "1.0.0",
    description:
      "REST API for the ClipCash AI-powered video clipping platform. " +
      "Authentication is via NextAuth sessions (cookie-based) unless noted otherwise.",
    contact: {
      name: "ClipCash Engineering",
      url: "https://github.com/ANYTECHS/clips-frontend",
    },
    license: {
      name: "Private",
    },
  },
  servers: [
    {
      url: "/api",
      description: "Current host",
    },
  ],
  tags: [
    { name: "auth", description: "Authentication and passkeys" },
    { name: "clips", description: "Clip library management" },
    { name: "jobs", description: "AI processing jobs" },
    { name: "upload", description: "Video uploads" },
    { name: "earnings", description: "Revenue and transactions" },
    { name: "dashboard", description: "Dashboard aggregates" },
    { name: "projects", description: "Project management" },
    { name: "transform", description: "AI style-transfer" },
    { name: "user", description: "User profile and settings" },
    { name: "billing", description: "Subscription and billing" },
    { name: "notifications", description: "In-app notifications" },
    { name: "wallet", description: "Stellar wallet and balances" },
    { name: "nft", description: "NFT minting on Stellar Soroban" },
    { name: "health", description: "Health and readiness checks" },
    { name: "prices", description: "Crypto asset prices" },
    { name: "recovery", description: "Social key recovery" },
  ],

  // ─── Security Schemes ──────────────────────────────────────────────────────
  components: {
    securitySchemes: {
      sessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "next-auth.session-token",
        description: "NextAuth session cookie (set automatically on sign-in)",
      },
      bearerSecret: {
        type: "http",
        scheme: "bearer",
        description:
          "Shared secret Bearer token — used by internal services only (e.g. AI callback).",
      },
    },

    // ─── Reusable Schemas ────────────────────────────────────────────────────
    schemas: {
      // ── Envelope ────────────────────────────────────────────────────────────
      ApiResponse: {
        type: "object",
        required: ["data", "error"],
        properties: {
          data: {
            description: "Response payload. Null on error.",
          },
          error: {
            type: ["string", "null"],
            description: "Human-readable error message. Null on success.",
            example: null,
          },
          code: {
            type: "string",
            description: "Machine-readable error code.",
            example: "NOT_FOUND",
          },
          meta: {
            $ref: "#/components/schemas/ResponseMeta",
          },
        },
      },

      ResponseMeta: {
        type: "object",
        properties: {
          requestId: { type: "string", format: "uuid" },
          timestamp: { type: "string", format: "date-time" },
          page: { type: "integer" },
          pageSize: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" },
          hasNextPage: { type: "boolean" },
          hasPrevPage: { type: "boolean" },
        },
      },

      // ── Errors ───────────────────────────────────────────────────────────────
      Error401: {
        allOf: [
          { $ref: "#/components/schemas/ApiResponse" },
          {
            properties: {
              error: { example: "Unauthorized" },
              code: { example: "UNAUTHORIZED" },
            },
          },
        ],
      },
      Error403: {
        allOf: [
          { $ref: "#/components/schemas/ApiResponse" },
          {
            properties: {
              error: { example: "Forbidden" },
              code: { example: "FORBIDDEN" },
            },
          },
        ],
      },
      Error404: {
        allOf: [
          { $ref: "#/components/schemas/ApiResponse" },
          {
            properties: {
              error: { example: "Not found" },
              code: { example: "NOT_FOUND" },
            },
          },
        ],
      },
      Error429: {
        allOf: [
          { $ref: "#/components/schemas/ApiResponse" },
          {
            properties: {
              error: { example: "Too many requests" },
              code: { example: "RATE_LIMITED" },
            },
          },
        ],
      },

      // ── Domain models ─────────────────────────────────────────────────────────
      Job: {
        type: "object",
        required: ["id", "userId", "status", "progress"],
        properties: {
          id: { type: "string", example: "job_abc123" },
          userId: { type: "string" },
          status: {
            type: "string",
            enum: ["queued", "processing", "complete", "error"],
          },
          progress: { type: "integer", minimum: 0, maximum: 100 },
          momentsFound: { type: "integer" },
          estimatedSecondsRemaining: { type: "integer" },
          errorCode: { type: "string" },
          errorMessage: { type: "string" },
        },
      },

      Clip: {
        type: "object",
        required: ["id", "title", "status"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          status: { type: "string", enum: ["pending", "ready", "posted", "archived"] },
          style: { type: "string" },
          scoreKey: { type: "string", enum: ["high", "medium", "low"] },
          url: { type: "string", format: "uri" },
          thumbnailUrl: { type: "string", format: "uri" },
          duration: { type: "number", description: "Duration in seconds" },
          createdAt: { type: "string", format: "date-time" },
        },
      },

      UploadResult: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          jobId: { type: "string", example: "job_abc123" },
          files: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                size: { type: "integer" },
                type: { type: "string" },
                jobId: { type: "string" },
                url: { type: "string", format: "uri" },
              },
            },
          },
        },
      },

      HealthStatus: {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["ok", "degraded", "down"] },
          version: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
          uptime: { type: "number", description: "Process uptime in seconds" },
          dependencies: {
            type: "object",
            additionalProperties: {
              type: "object",
              properties: {
                status: { type: "string", enum: ["ok", "degraded", "down"] },
                latencyMs: { type: "number" },
                message: { type: "string" },
              },
            },
          },
        },
      },
    },

    responses: {
      Unauthorized: {
        description: "Authentication required",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/Error401" } },
        },
      },
      Forbidden: {
        description: "Access denied",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/Error403" } },
        },
      },
      NotFound: {
        description: "Resource not found",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/Error404" } },
        },
      },
      RateLimited: {
        description: "Too many requests",
        headers: {
          "Retry-After": { schema: { type: "integer" } },
        },
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/Error429" } },
        },
      },
    },
  },

  security: [{ sessionCookie: [] }],

  // ─── Paths ─────────────────────────────────────────────────────────────────
  paths: {
    // ── Health ──────────────────────────────────────────────────────────────
    "/health": {
      get: {
        tags: ["health"],
        summary: "Basic liveness probe",
        operationId: "getHealth",
        security: [],
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      properties: {
                        data: { $ref: "#/components/schemas/HealthStatus" },
                      },
                    },
                  ],
                },
              },
            },
          },
          "503": { description: "Service is unhealthy" },
        },
      },
    },
    "/health/ready": {
      get: {
        tags: ["health"],
        summary: "Readiness probe — checks all dependencies",
        operationId: "getHealthReady",
        security: [],
        responses: {
          "200": {
            description: "All dependencies healthy",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      properties: {
                        data: { $ref: "#/components/schemas/HealthStatus" },
                      },
                    },
                  ],
                },
              },
            },
          },
          "503": { description: "One or more dependencies are unhealthy" },
        },
      },
    },

    // ── Upload ───────────────────────────────────────────────────────────────
    "/upload": {
      post: {
        tags: ["upload"],
        summary: "Upload video files for AI processing",
        operationId: "uploadVideo",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["files"],
                properties: {
                  files: {
                    type: "array",
                    items: { type: "string", format: "binary" },
                    description: "Video files. Max 500 MB each. Formats: MP4, MOV, AVI, MKV.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Files uploaded and processing job created",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      properties: {
                        data: { $ref: "#/components/schemas/UploadResult" },
                      },
                    },
                  ],
                },
                example: {
                  data: {
                    success: true,
                    jobId: "job_abc123",
                    files: [
                      {
                        name: "video.mp4",
                        size: 104857600,
                        type: "video/mp4",
                        jobId: "job_abc123",
                        url: "https://cdn.example.com/uploads/video.mp4",
                      },
                    ],
                  },
                  error: null,
                },
              },
            },
          },
          "400": { description: "Invalid file or validation error" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
    },

    // ── Jobs ─────────────────────────────────────────────────────────────────
    "/jobs/{jobId}": {
      parameters: [
        {
          name: "jobId",
          in: "path",
          required: true,
          schema: { type: "string" },
          example: "job_abc123",
        },
      ],
      get: {
        tags: ["jobs"],
        summary: "Poll job status",
        operationId: "getJob",
        responses: {
          "200": {
            description: "Job status",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    { properties: { data: { $ref: "#/components/schemas/Job" } } },
                  ],
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      post: {
        tags: ["jobs"],
        summary: "Restart a job",
        operationId: "restartJob",
        responses: {
          "200": { description: "Job restarted" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/jobs/{jobId}/stream": {
      parameters: [
        { name: "jobId", in: "path", required: true, schema: { type: "string" } },
      ],
      get: {
        tags: ["jobs"],
        summary: "Server-Sent Events stream of live job progress",
        operationId: "streamJob",
        responses: {
          "200": {
            description: "SSE stream",
            content: { "text/event-stream": { schema: { type: "string" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/jobs/metrics": {
      get: {
        tags: ["jobs"],
        summary: "Aggregate job metrics for the signed-in user",
        operationId: "getJobMetrics",
        responses: {
          "200": { description: "Job metrics" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // ── Clips ────────────────────────────────────────────────────────────────
    "/clips": {
      get: {
        tags: ["clips"],
        summary: "List clips for the signed-in user",
        operationId: "listClips",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["all", "pending", "ready", "posted", "archived"],
            },
          },
          { name: "style", in: "query", schema: { type: "string" } },
          {
            name: "virality",
            in: "query",
            schema: { type: "array", items: { type: "string" } },
          },
        ],
        responses: {
          "200": {
            description: "Paginated clip list",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            clips: {
                              type: "array",
                              items: { $ref: "#/components/schemas/Clip" },
                            },
                            total: { type: "integer" },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      delete: {
        tags: ["clips"],
        summary: "Bulk soft-delete clips",
        operationId: "deleteClips",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["clipIds"],
                properties: {
                  clipIds: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Clips deleted" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },

    // ── Dashboard ────────────────────────────────────────────────────────────
    "/dashboard": {
      get: {
        tags: ["dashboard"],
        summary: "Aggregated dashboard data",
        operationId: "getDashboard",
        responses: {
          "200": { description: "Dashboard stats, revenue trend, recent projects" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // ── Earnings ─────────────────────────────────────────────────────────────
    "/earnings": {
      get: {
        tags: ["earnings"],
        summary: "Earnings summary totals",
        operationId: "getEarnings",
        responses: {
          "200": { description: "Earnings totals and trends" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/earnings/transactions": {
      get: {
        tags: ["earnings"],
        summary: "Paginated earnings transaction list",
        operationId: "listTransactions",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": { description: "Paginated transactions" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // ── User ─────────────────────────────────────────────────────────────────
    "/user/profile": {
      get: {
        tags: ["user"],
        summary: "Get signed-in user's profile",
        operationId: "getUserProfile",
        responses: {
          "200": { description: "User profile" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      patch: {
        tags: ["user"],
        summary: "Update signed-in user's profile",
        operationId: "updateUserProfile",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  bio: { type: "string" },
                  avatarUrl: { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Profile updated" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // ── Transform ────────────────────────────────────────────────────────────
    "/transform": {
      post: {
        tags: ["transform"],
        summary: "Start a style-transfer job",
        operationId: "startTransform",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["clipId", "style"],
                properties: {
                  clipId: { type: "string" },
                  style: {
                    type: "string",
                    enum: ["anime", "cinematic", "sketch", "watercolor"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Transform job created" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/transform/styles": {
      get: {
        tags: ["transform"],
        summary: "List available transform styles",
        operationId: "listTransformStyles",
        security: [],
        responses: {
          "200": { description: "Style catalogue" },
        },
      },
    },

    // ── Billing ───────────────────────────────────────────────────────────────
    "/billing/plans": {
      get: {
        tags: ["billing"],
        summary: "List available subscription plans",
        operationId: "listBillingPlans",
        responses: {
          "200": { description: "Billing plan list" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/billing/checkout": {
      post: {
        tags: ["billing"],
        summary: "Create a checkout session",
        operationId: "createCheckout",
        responses: {
          "200": { description: "Checkout session URL" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // ── Prices ────────────────────────────────────────────────────────────────
    "/prices/xlm": {
      get: {
        tags: ["prices"],
        summary: "Current XLM/USD price",
        operationId: "getXlmPrice",
        security: [],
        responses: {
          "200": { description: "XLM price in USD" },
        },
      },
    },

    "/prices/assets": {
      get: {
        tags: ["prices"],
        summary: "USD prices for a set of asset codes",
        operationId: "getAssetPrices",
        security: [],
        responses: {
          "200": { description: "Asset prices" },
        },
      },
    },

    // ── NFT ───────────────────────────────────────────────────────────────────
    "/nft/mint": {
      post: {
        tags: ["nft"],
        summary: "Mint a clip as a Soroban NFT",
        operationId: "mintNft",
        responses: {
          "200": { description: "Mint transaction submitted" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // ── Recovery ──────────────────────────────────────────────────────────────
    "/recovery/initiate": {
      post: {
        tags: ["recovery"],
        summary: "Initiate a social key recovery session",
        operationId: "initiateRecovery",
        security: [],
        responses: {
          "200": { description: "Recovery initiated — guardian emails sent" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
    },

    "/recovery/check": {
      get: {
        tags: ["recovery"],
        summary: "Poll recovery status",
        operationId: "checkRecovery",
        security: [],
        parameters: [
          { name: "sessionId", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Recovery status" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
  },
} as const;

export type OpenApiSpec = typeof openApiSpec;

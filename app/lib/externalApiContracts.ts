import { z } from "zod";

export const API_CONTRACT_VERSION = "2026-08-28" as const;

export const ExternalApiEnvelopeSchema = z.object({
  version: z.literal(API_CONTRACT_VERSION),
  ok: z.boolean(),
  data: z.object({
    id: z.string().min(1),
    status: z.enum(["ok", "error"]),
    message: z.string().optional(),
  }),
});

export type ExternalApiEnvelope = z.infer<typeof ExternalApiEnvelopeSchema>;

export function validateExternalApiEnvelope(payload: unknown): ExternalApiEnvelope {
  const parsed = ExternalApiEnvelopeSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error(
      `External API payload does not match the ${API_CONTRACT_VERSION} contract: ${parsed.error.message}`
    );
  }

  return parsed.data;
}

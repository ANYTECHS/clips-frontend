import { z } from "zod";

/**
 * Request body for POST /api/billing/checkout
 */
export const checkoutBodySchema = z.object({
  planId: z.enum(["pro", "enterprise"]),
});

/**
 * Query parameters for GET /api/billing/plans
 */
export const getPlansQuerySchema = z.object({
  annual: z.string().optional().transform((val) => val === "true"),
});

export type CheckoutBody = z.infer<typeof checkoutBodySchema>;
export type GetPlansQuery = z.infer<typeof getPlansQuerySchema>;

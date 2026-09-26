import { z } from "zod";

export const privacySettingsSchema = z.object({
  exploreOptIn: z.boolean().optional(),
  showUsername: z.boolean().optional(),
});

export type PrivacySettingsBody = z.infer<typeof privacySettingsSchema>;

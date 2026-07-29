import { z } from "zod";

export const renameProjectBodySchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
});

export type RenameProjectBody = z.infer<typeof renameProjectBodySchema>;

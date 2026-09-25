import { auth } from "@/app/lib/auth";

export interface TemplateScope {
  userId: string;
  teamId: string | null;
}

/**
 * Resolve template ownership from the authenticated session.
 *
 * The current auth type does not yet expose team membership, but installations
 * that provide `teamId` on the session get real team sharing immediately. A
 * personal scope is used as a safe fallback rather than leaking every shared
 * template across all users.
 */
export async function getTemplateScope(): Promise<TemplateScope | null> {
  const session = await auth();
  const user = session?.user as { id?: string; teamId?: string } | undefined;
  if (!user?.id) return null;
  return {
    userId: user.id,
    teamId: typeof user.teamId === "string" && user.teamId.trim()
      ? user.teamId.trim()
      : null,
  };
}


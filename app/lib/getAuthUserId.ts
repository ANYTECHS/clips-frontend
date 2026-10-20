import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

/**
 * Resolves the authenticated user ID from the session or database.
 */
export async function getAuthUserId(): Promise<string | null> {
  const session = await auth();
  const sessionUser = session?.user as { id?: string; email?: string | null } | undefined;
  if (!sessionUser) return null;

  if (sessionUser.id) {
    return sessionUser.id;
  }

  if (sessionUser.email) {
    try {
      const userByEmail = await prisma.user.findUnique({
        where: { email: sessionUser.email },
        select: { id: true },
      });
      if (userByEmail?.id) return userByEmail.id;
    } catch {
      // Database not available or mocked
    }
    return sessionUser.email;
  }

  return null;
}

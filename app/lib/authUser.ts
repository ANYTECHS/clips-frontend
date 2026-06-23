import type { Session } from "next-auth";
import type { User } from "./mockApi";
import { DEFAULT_ONBOARDING_STEP } from "./mockApi";

const CLIPCASH_USER_KEY = "clipcash_user";

export function mapSessionToUser(session: Session): User {
  const sessionUser = session.user as {
    id?: string;
    email?: string | null;
    name?: string | null;
    onboardingStep?: number;
    profile?: User["profile"];
  };

  return {
    id: sessionUser.id ?? sessionUser.email ?? "",
    email: sessionUser.email ?? "",
    name: sessionUser.name ?? undefined,
    onboardingStep: sessionUser.onboardingStep ?? DEFAULT_ONBOARDING_STEP,
    profile: sessionUser.profile ?? {},
  };
}

export function persistClipcashUser(user: User & { password?: string }): void {
  if (typeof window === "undefined") return;
  const { password: _password, ...safeUser } = user;
  void _password;
  localStorage.setItem(CLIPCASH_USER_KEY, JSON.stringify(safeUser));
}

export function clearClipcashUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CLIPCASH_USER_KEY);
}

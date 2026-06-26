import type { Session } from "next-auth";
import type { User } from "./types";
import { DEFAULT_ONBOARDING_STEP } from "./types";
import { secureStorage } from "./secureStorage";

const CLIPCASH_USER_KEY = "clipcash_user";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type PersistedUser = Omit<User, "password" | "walletAddress" | "walletType"> & {
  expiresAt: number;
};

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

export async function persistClipcashUser(user: User & { password?: string }): Promise<void> {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _p, walletAddress: _w, walletType: _t, ...safeUser } = user;
  const payload: PersistedUser = { ...safeUser, expiresAt: Date.now() + TTL_MS };
  await secureStorage.setItem(CLIPCASH_USER_KEY, JSON.stringify(payload));
}

export async function loadClipcashUser(): Promise<Omit<PersistedUser, "expiresAt"> | null> {
  if (typeof window === "undefined") return null;
  try {
    const raw = await secureStorage.getItem(CLIPCASH_USER_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as PersistedUser;
    if (Date.now() > stored.expiresAt) {
      await secureStorage.removeItem(CLIPCASH_USER_KEY);
      return null;
    }
    const { expiresAt: _, ...user } = stored;
    return user;
  } catch {
    await secureStorage.removeItem(CLIPCASH_USER_KEY);
    return null;
  }
}

export async function clearClipcashUser(): Promise<void> {
  if (typeof window === "undefined") return;
  await secureStorage.removeItem(CLIPCASH_USER_KEY);
}

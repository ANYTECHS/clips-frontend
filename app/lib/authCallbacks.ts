import type { Account, Profile, Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import {
  DEFAULT_ONBOARDING_STEP,
  getOnboardingStepForEmail,
} from "./mockApi";

export async function jwtCallback({
  token,
  account,
  profile,
  user,
}: {
  token: JWT;
  account: Account | null;
  profile?: Profile;
  user?: User;
}): Promise<JWT> {
  if (account) {
    token.accessToken = account.access_token;
    token.provider = account.provider;
    if (profile) {
      token.profile = profile;
    }
  }
  const email = user?.email ?? (token.email as string | undefined);
  if (email) {
    token.onboardingStep = getOnboardingStepForEmail(email);
  }
  return token;
}

export async function sessionCallback({
  session,
  token,
}: {
  session: Session;
  token: JWT;
}): Promise<Session> {
  if (session.user) {
    const onboardingStep =
      typeof token.onboardingStep === "number"
        ? token.onboardingStep
        : getOnboardingStepForEmail(session.user.email);

    (session.user as { onboardingStep: number }).onboardingStep =
      onboardingStep ?? DEFAULT_ONBOARDING_STEP;
    (session.user as { accessToken?: string }).accessToken = token.accessToken as
      | string
      | undefined;
    (session.user as { provider?: string }).provider = token.provider as
      | string
      | undefined;
    (session.user as { profile?: Profile }).profile = token.profile as
      | Profile
      | undefined;
  }
  return session;
}

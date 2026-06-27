import type { Account, Profile, Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { DEFAULT_ONBOARDING_STEP } from "./types";
import { fetchOnboardingStep } from "./userApi";

/**
 * Intercepts JSON Web Token mutations during authentication flows to populate access tokens,
 * identity provider designations, profile details, and synchronized registration wizard tiers.
 *
 * @param context - The context object payload containing authorization state changes.
 * @param context.token - Mutatable current storage representation of the underlying session container.
 * @param context.account - Incoming credential configuration payload available strictly on early login occurrences.
 * @param context.profile - Vendor specific user resource metadata returned by authorization providers.
 * @param context.user - Baseline identity reference metrics tracking active entity parameters.
 * @returns Updated state matrix mapping persisted credential metrics.
 */
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
  // `account` is only non-null on the initial sign-in, not on subsequent token
  // refreshes. We use this to fetch a fresh onboardingStep from the backend
  // exactly once and store it in the JWT, avoiding a backend round-trip on
  // every session read.
  if (account) {
    token.accessToken = account.access_token;
    token.provider = account.provider;
    if (profile) {
      token.profile = profile;
    }

    const onboardingStep = (user as any)?.onboardingStep;
    if (typeof onboardingStep === "number") {
      token.onboardingStep = onboardingStep;
    } else {
      const email = user?.email ?? (token.email as string | undefined);
      if (email) {
        token.onboardingStep = await fetchOnboardingStep(
          email,
          account.access_token
        );
      }
    }
  }

  return token;
}

/**
 * Constructs user-facing session models out of underlying token states, exposing tracking indicators 
 * like application access tokens and active setup steps safely onto client-side hooks.
 *
 * @param context - Structural synchronization state details.
 * @param context.session - Client-accessible storage object frame detailing current application authorization parameters.
 * @param context.token - Cryptographically secured internal state context payload driving user authorizations.
 * @returns Session parameters formatted with platform-wide onboarding identifiers and tracking tokens.
 */
export async function sessionCallback({
  session,
  token,
}: {
  session: Session;
  token: JWT;
}): Promise<Session> {
  if (session.user) {
    if (token.sub) {
      (session.user as { id?: string }).id = token.sub;
    }

    // Always read onboardingStep from the JWT — it was populated on sign-in
    // and is the authoritative value for this session.
    (session.user as { onboardingStep: number }).onboardingStep =
      typeof token.onboardingStep === "number"
        ? token.onboardingStep
        : DEFAULT_ONBOARDING_STEP;

    (session.user as { accessToken?: string }).accessToken =
      token.accessToken as string | undefined;
    (session.user as { provider?: string }).provider =
      token.provider as string | undefined;
    (session.user as { profile?: Profile }).profile =
      token.profile as Profile | undefined;
  }
  return session;
}

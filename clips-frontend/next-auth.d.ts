import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      /** The OAuth provider used for the current session (e.g. "google", "tiktok") */
      provider?: string;
      /** Raw OAuth access token — treat as sensitive */
      accessToken?: string;
      /** Provider profile data */
      profile?: Record<string, unknown>;
      /** Onboarding step (1 = new user, 3 = completed) */
      onboardingStep?: number;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    provider?: string;
    accessToken?: string;
    refreshToken?: string | null;
    profile?: Record<string, unknown>;
  }
}

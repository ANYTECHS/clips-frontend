import type { DefaultSession, DefaultJWT } from "next-auth";
import type { Profile } from "next-auth";

declare module "next-auth" {
  /**
   * Extended Session interface with custom user fields.
   */
  interface Session {
    user: {
      id: string;
      onboardingStep: number;
      accessToken?: string;
      provider?: string;
      profile?: Profile;
    } & DefaultSession["user"];
  }

  /**
   * Extended User interface with custom fields.
   */
  interface User {
    onboardingStep?: number;
  }
}

declare module "next-auth/jwt" {
  /**
   * Extended JWT interface with custom fields.
   */
  interface JWT {
    onboardingStep?: number;
    accessToken?: string;
    provider?: string;
    profile?: Profile;
  }
}

import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import Twitter from "next-auth/providers/twitter";
import Instagram from "next-auth/providers/instagram";
import Credentials from "next-auth/providers/credentials";
import { jwtCallback, sessionCallback } from "./authCallbacks";
import { getSecureCookieConfig, getSessionSecurityConfig, createTrackedSession } from "./sessionSecurity";
import { prisma } from "@/app/lib/prisma";
import { logger } from "@/app/lib/logger";
// eslint-disable-next-line no-restricted-imports -- TODO: replace MockApi with real recovery API (tracked separately)
import { MockApi } from "@/__mocks__/app/lib/mockApi";

/**
 * The Apple provider in Auth.js v5 expects `clientSecret` to be a pre-generated
 * JWT string (see https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret).
 * At runtime the library also accepts an object with the raw key material and
 * generates the JWT internally — but its TypeScript signature only exposes `string`.
 * We define the object shape explicitly and widen to `string` so TypeScript is
 * satisfied without resorting to `as any`.
 */
interface AppleClientSecretConfig {
  appleId: string;
  teamId: string;
  privateKey: string;
  keyId: string;
}

/**
 * Auth.js v5's `OAuthUserConfig` does not expose the `version` field that the
 * Twitter provider accepts at runtime to opt into OAuth 2.0. We extend the
 * config type locally so the object literal passes the excess-property check.
 */
interface TwitterProviderConfig {
  clientId: string;
  clientSecret: string;
  /** Pass "2.0" to opt into Twitter OAuth 2.0 (PKCE). Defaults to OAuth 1.0a. */
  version?: string;
}

/**
 * Auth.js v5 configuration — Issue #530
 *
 * Replaces the v4 `NextAuthOptions` type with the v5 `NextAuthConfig` type.
 * All OAuth providers (Google, Apple, Twitter/X, Instagram, TikTok) and
 * callbacks (jwt, session) are preserved from the original implementation.
 *
 * Breaking changes handled:
 * - `NextAuthOptions` → `NextAuthConfig`
 * - Named default imports updated (e.g. `GoogleProvider` → `Google`)
 * - `getServerSession(authOptions)` callers should use `auth()` from next-auth
 * (handled in route.ts)
 *
 * @type {NextAuthConfig}
 */
export const authOptions: NextAuthConfig = {
  /** High-level array configuring OAuth and multi-platform media identity provider interfaces. */
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/youtube.readonly",
        },
      },
    }),
    Apple({
      clientId: process.env.APPLE_ID!,
      // Auth.js v5's Apple provider types declare `clientSecret` as `string`, but
      // the runtime also accepts an object with the raw key material so it can
      // generate the required JWT internally. We define the shape via
      // `AppleClientSecretConfig` and widen with `as unknown as string` so the
      // compiler is satisfied without an unsafe `as any`.
      clientSecret: {
        appleId: process.env.APPLE_ID!,
        teamId: process.env.APPLE_TEAM_ID!,
        privateKey: process.env.APPLE_PRIVATE_KEY!,
        keyId: process.env.APPLE_KEY_ID!,
      } as AppleClientSecretConfig as unknown as string,
    }),
    Twitter({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: "2.0",
    } as TwitterProviderConfig),
    Instagram({
      clientId: process.env.INSTAGRAM_CLIENT_ID!,
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET!,
    }),
    {
      id: "tiktok",
      name: "TikTok",
      type: "oauth",
      authorization: {
        url: "https://www.tiktok.com/v2/auth/authorize/",
        params: {
          client_key: process.env.TIKTOK_CLIENT_KEY,
          scope: "user.info.basic,video.list",
          response_type: "code",
        },
      },
      token: "https://open.tiktokapis.com/v2/oauth/token/",
      userinfo: "https://open.tiktokapis.com/v2/user/info/",
      /**
       * Maps incoming TikTok userinfo profile shapes into standard NextAuth user payloads.
       * @param profile - Raw endpoint object mapping data containing nested account payload fields.
       * @returns Normed profile container parameters.
       */
      profile(profile: { data: { user: { open_id: string; display_name: string; avatar_url: string } } }) {
        return {
          id: profile.data.user.open_id,
          name: profile.data.user.display_name,
          image: profile.data.user.avatar_url,
        };
      },
      clientId: process.env.TIKTOK_CLIENT_KEY,
      clientSecret: process.env.TIKTOK_CLIENT_SECRET,
    },
    Credentials({
      id: "recovery",
      name: "Recovery",
      credentials: {
        publicKey: { label: "Public Key", type: "text" },
        signature: { label: "Signature", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.publicKey || !credentials?.signature) {
          return null;
        }

        // Rate limiting
        const ip = req.headers?.get("x-forwarded-for") || "unknown";
        const now = Date.now();
        const limit = MockApi.recoveryAttempts.get(ip);
        if (limit && limit.lockUntil > now) {
          throw new Error("Too many failed attempts. Try again later.");
        }

        try {
          const user = await MockApi.verifyRecoverySignature(
            credentials.publicKey as string,
            credentials.signature as string
          );
          if (user) {
            MockApi.recoveryAttempts.delete(ip);
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              onboardingStep: user.onboardingStep,
            };
          }
          throw new Error("Invalid signature");
        } catch (error) {
          const count = (limit?.count || 0) + 1;
          if (count >= 5) {
            MockApi.recoveryAttempts.set(ip, { count, lockUntil: now + 15 * 60 * 1000 });
          } else {
            MockApi.recoveryAttempts.set(ip, { count, lockUntil: 0 });
          }
          throw new Error("Authentication failed");
        }
      },
    }),
  ],
  /** Action intercept hooks controlling lifecycle transitions during identity confirmation stages. */
  callbacks: {
    jwt: jwtCallback,
    session: sessionCallback,
  },
  /**
   * Auth.js v5 lifecycle events — fired after the action completes.
   *
   * signIn: Called on every successful authentication (OAuth, credentials, magic link).
   * We use it to create a tracked UserSession row and trigger the suspicious-login
   * detector.  The event callback does not receive the raw Request object, so IP and
   * user-agent are read from the user's most-recent session row instead of the headers.
   *
   * NOTE: Auth.js v5 event handlers receive { user, account, isNewUser }.
   * They are fire-and-forget — errors here are logged but do not fail the login.
   */
  events: {
    async signIn({ user }) {
      if (!user?.id || !user?.email) return;

      try {
        // createTrackedSession without a req — IP/UA will be "unknown" here
        // because Auth.js events don't expose the raw Request.  The session
        // will still be created and geo/anomaly checks are skipped for unknown
        // IPs.  For full IP capture, callers can also invoke createTrackedSession
        // directly from an instrumented route handler that has access to req.
        await createTrackedSession(user.id, undefined, user.email);
      } catch (err) {
        logger.error("[Auth] Failed to create tracked session on signIn", {
          userId: user.id,
          err,
        });
      }
    },
    async signOut(message) {
      // Best-effort: look up the user and revoke their active sessions.
      // In JWT strategy the message contains { token: JWT }.
      // token.sub is the user id.
      const token = "token" in message ? message.token : null;
      const userId = token?.sub;
      if (!userId) return;
      try {
        await prisma.userSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      } catch (err) {
        logger.error("[Auth] Failed to revoke sessions on signOut", { userId, err });
      }
    },
  },
  session: {
    strategy: "jwt",
    maxAge: getSessionSecurityConfig().sessionMaxAgeSeconds,
    updateAge: 10 * 60,
  },
  useSecureCookies: process.env.NODE_ENV === "production",
  cookies: getSecureCookieConfig(process.env.NODE_ENV === "production"),
  /** Custom route mappings overriding core fallback display interface links. */
  pages: {
    signIn: "/login",
    error: "/login",
  },
};

import NextAuth from "next-auth";

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);

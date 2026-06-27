import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import Twitter from "next-auth/providers/twitter";
import Instagram from "next-auth/providers/instagram";
import Credentials from "next-auth/providers/credentials";
import { jwtCallback, sessionCallback } from "./authCallbacks";
import { MockApi } from "./mockApi";

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
      clientSecret: {
        appleId: process.env.APPLE_ID!,
        teamId: process.env.APPLE_TEAM_ID!,
        privateKey: process.env.APPLE_PRIVATE_KEY!,
        keyId: process.env.APPLE_KEY_ID!,
      } as any,
    }),
    Twitter({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: "2.0",
    }),
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
      profile(profile: any) {
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
  /** Custom route mappings overriding core fallback display interface links. */
  pages: {
    signIn: "/login",
    error: "/login",
  },
};

import NextAuth from "next-auth";

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);

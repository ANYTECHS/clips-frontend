import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import TwitterProvider from "next-auth/providers/twitter";
import InstagramProvider from "next-auth/providers/instagram";
import { upsertConnection, type SocialPlatform } from "@/app/lib/platformConnections";

/**
 * Map a NextAuth provider ID to our internal SocialPlatform type.
 */
function toSocialPlatform(providerId: string): SocialPlatform | null {
  const map: Record<string, SocialPlatform> = {
    google: "google",
    apple: "apple",
    tiktok: "tiktok",
    twitter: "twitter",
    instagram: "instagram",
  };
  return map[providerId] ?? null;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/youtube.readonly",
        },
      },
    }),
    AppleProvider({
      clientId: process.env.APPLE_ID!,
      clientSecret: {
        appleId: process.env.APPLE_ID!,
        teamId: process.env.APPLE_TEAM_ID!,
        privateKey: process.env.APPLE_PRIVATE_KEY!,
        keyId: process.env.APPLE_KEY_ID!,
      } as any,
    }),
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: "2.0",
    }),
    InstagramProvider({
      clientId: process.env.INSTAGRAM_CLIENT_ID!,
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET!,
    }),
    // TikTok uses a custom provider (not in next-auth built-ins)
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
  ],

  callbacks: {
    /**
     * Persist OAuth tokens in the JWT and upsert the platform_connections
     * record on every actual sign-in (account is only present then).
     */
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token ?? null;
        token.provider = account.provider;
        if (profile) {
          token.profile = profile;
        }

        // Upsert platform connection whenever a user signs in via OAuth.
        const platform = toSocialPlatform(account.provider);
        if (platform && token.email) {
          const username =
            (profile as any)?.name ??
            (profile as any)?.display_name ??
            (profile as any)?.login ??
            null;

          upsertConnection({
            userId: token.email as string,
            platform,
            accessToken: account.access_token ?? null,
            refreshToken: account.refresh_token ?? null,
            username,
            connectedAt: new Date().toISOString(),
          });
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.onboardingStep = session.user.email?.includes("new") ? 1 : 3;
        session.user.accessToken = token.accessToken;
        session.user.provider = token.provider;
        session.user.profile = token.profile;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
};

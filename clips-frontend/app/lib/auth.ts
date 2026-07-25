import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
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
          scope:
            "openid email profile https://www.googleapis.com/auth/youtube.readonly",
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
    } as any,
    // Twitter / X OAuth 2.0
    {
      id: "twitter",
      name: "X / Twitter",
      type: "oauth",
      version: "2.0",
      authorization: {
        url: "https://twitter.com/i/oauth2/authorize",
        params: {
          scope: "tweet.read users.read offline.access",
          response_type: "code",
          code_challenge_method: "S256",
        },
      },
      token: "https://api.twitter.com/2/oauth2/token",
      userinfo: "https://api.twitter.com/2/users/me",
      profile(profile: any) {
        return {
          id: profile.data.id,
          name: profile.data.name,
          image: profile.data.profile_image_url ?? null,
        };
      },
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
    } as any,
    // Instagram OAuth
    {
      id: "instagram",
      name: "Instagram",
      type: "oauth",
      authorization: {
        url: "https://api.instagram.com/oauth/authorize",
        params: {
          scope: "user_profile,user_media",
          response_type: "code",
        },
      },
      token: "https://api.instagram.com/oauth/access_token",
      userinfo: "https://graph.instagram.com/me?fields=id,username",
      profile(profile: any) {
        return {
          id: profile.id,
          name: profile.username,
          image: null,
        };
      },
      clientId: process.env.INSTAGRAM_CLIENT_ID,
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
    } as any,
  ],

  callbacks: {
    /**
     * Persist OAuth tokens in the JWT and upsert the platform_connections
     * record on every actual sign-in (account is only present then).
     */
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token ?? null;
        token.refreshToken = account.refresh_token ?? null;
        token.provider = account.provider;

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
        (session.user as any).provider = token.provider ?? null;
        (session.user as any).accessToken = token.accessToken;
        // Assuming the API returns user data including onboardingStep
        // For now, mock it
        (session.user as any).onboardingStep = session.user.email?.includes("new")
          ? 1
          : 3; // Mock logic
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
};

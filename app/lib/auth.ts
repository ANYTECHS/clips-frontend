import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import TwitterProvider from "next-auth/providers/twitter";
import InstagramProvider from "next-auth/providers/instagram";
import { jwtCallback, sessionCallback } from "./authCallbacks";

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
    jwt: jwtCallback,
    session: sessionCallback,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};

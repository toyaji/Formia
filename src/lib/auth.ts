import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Prisma v7의 PrismaClient 타입이 @auth/prisma-adapter와 호환되지 않아 타입 캐스팅
  adapter: PrismaAdapter(prisma as any),
  providers: [
    Google({
      // Google Cloud Console에서 OAuth 2.0 클라이언트 생성 후 아래 값을 .env.local에 설정하세요.
      // 가이드: https://console.cloud.google.com/apis/credentials
      // Authorized redirect URI: http://localhost:3000/api/auth/callback/google
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'database',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    session({ session, user }) {
      // 세션에 userId 포함
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});

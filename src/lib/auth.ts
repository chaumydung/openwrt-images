// Auth.js (NextAuth v5) configuration — GitHub OAuth only (PRD §7), JWT sessions (no DB
// session table), user upsert on sign-in. Business code must NOT import this file directly;
// use getSessionUser() from '@/lib/session' instead.
import NextAuth, { type DefaultSession } from 'next-auth'
import GitHub from 'next-auth/providers/github'
import { getDb } from '@/lib/db'

declare module 'next-auth' {
  interface Session {
    user: { id: string; login: string } & DefaultSession['user']
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  session: { strategy: 'jwt' },
  callbacks: {
    // Data minimization (PRD §7): persist only GitHub id + login; createdAt is set by the adapter.
    async signIn({ profile }) {
      if (profile?.id == null || typeof profile.login !== 'string') return false
      await getDb().users.upsert({ id: String(profile.id), githubLogin: profile.login })
      return true
    },
    async jwt({ token, profile }) {
      if (profile) {
        token.userId = String(profile.id)
        token.githubLogin = String(profile.login)
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.userId as string
      session.user.login = token.githubLogin as string
      return session
    },
  },
})

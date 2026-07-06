// Unified session entry point — CONTRACT: all business code (build API, quota checks, pages)
// must obtain the current user ONLY via getSessionUser() from this file. Never import
// next-auth or '@/lib/auth' directly outside src/lib/ — this keeps mock mode working
// everywhere without OAuth credentials.
//
// Mock mode (APP_MODE !== 'real' or AUTH_GITHUB_ID missing): returns a fixed mock user,
// upserted into the in-memory DB; set MOCK_LOGGED_OUT=1 to simulate the logged-out state.
// Real mode: delegates to Auth.js auth().
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'

export type SessionUser = { id: string; login: string }

const MOCK_USER: SessionUser = { id: 'mock-user-1', login: 'mockdev' }

/** Returns the signed-in user, or null when logged out. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const mockMode = process.env.APP_MODE !== 'real' || !process.env.AUTH_GITHUB_ID
  if (mockMode) {
    if (process.env.MOCK_LOGGED_OUT === '1') return null
    await getDb().users.upsert({ id: MOCK_USER.id, githubLogin: MOCK_USER.login })
    return { ...MOCK_USER }
  }
  const session = await auth()
  if (!session?.user?.id) return null
  return { id: session.user.id, login: session.user.login }
}

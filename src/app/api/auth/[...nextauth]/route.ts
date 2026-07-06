// Mounts the Auth.js route handlers (sign-in/out, GitHub OAuth callback, session endpoints).
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers

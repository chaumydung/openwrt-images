// GET /api/builds/[id] — poll a build's status (owner only); syncs executor state into the DB.
import { getBuildStatus } from '@/lib/builds'
import { getSessionUser } from '@/lib/session'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) {
    return Response.json(
      { error: 'Sign in with GitHub to view your builds.', signInUrl: '/api/auth/signin' },
      { status: 401 },
    )
  }

  const { id } = await params
  const result = await getBuildStatus(id, user.id)
  if (!result.ok) {
    if (result.code === 'not-found') return Response.json({ error: 'Build not found' }, { status: 404 })
    return Response.json({ error: 'You can only view your own builds' }, { status: 403 })
  }
  return Response.json(result.view)
}

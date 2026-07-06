// POST /api/builds — submit a custom firmware build (signed-in users, 1 free build per UTC day).
import { submitBuild, validateBuildRequest } from '@/lib/builds'
import { getSessionUser } from '@/lib/session'

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return Response.json(
      { error: 'Sign in with GitHub to build custom firmware.', signInUrl: '/api/auth/signin' },
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const validated = validateBuildRequest(body)
  if (!validated.ok) return Response.json({ error: validated.error }, { status: 400 })

  const result = await submitBuild(user.id, validated.spec)
  if (!result.ok) {
    if (result.code === 'quota') {
      return Response.json(
        { error: 'Daily build limit reached (1 free build per day).', resetAt: result.resetAt.toISOString() },
        { status: 429 },
      )
    }
    return Response.json(
      { error: 'The build executor is currently unavailable. Your quota was not consumed — please try again later.' },
      { status: 503 },
    )
  }
  return Response.json({ id: result.id, queuePosition: result.queuePosition }, { status: 201 })
}

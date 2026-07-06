// POST /api/feedback — validates and stores footer feedback submissions (name/email/message).
import { getDb } from '@/lib/db'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_NAME = 100
const MAX_EMAIL = 254
const MAX_MESSAGE = 2000

// Basic in-process rate limit: 5 submissions per hour per IP. On serverless this Map is
// per-instance and resets on cold start, so it only softens abuse rather than preventing
// it — acceptable for a low-stakes feedback form.
const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 5
const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent)
    return true
  }
  recent.push(now)
  hits.set(ip, recent)
  return false
}

function validate(body: unknown): { name: string; email: string; message: string } | string {
  if (typeof body !== 'object' || body === null) return 'Request body must be a JSON object'
  const { name, email, message } = body as Record<string, unknown>
  if (typeof name !== 'string' || name.trim() === '') return 'Name is required'
  if (name.trim().length > MAX_NAME) return `Name must be at most ${MAX_NAME} characters`
  if (typeof email !== 'string' || email.trim() === '') return 'Email is required'
  if (email.trim().length > MAX_EMAIL || !EMAIL_RE.test(email.trim())) return 'Enter a valid email address'
  if (typeof message !== 'string' || message.trim() === '') return 'Message is required'
  if (message.trim().length > MAX_MESSAGE) return `Message must be at most ${MAX_MESSAGE} characters`
  return { name: name.trim(), email: email.trim(), message: message.trim() }
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (rateLimited(ip)) {
    return Response.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = validate(body)
  if (typeof result === 'string') {
    return Response.json({ error: result }, { status: 400 })
  }

  await getDb().feedback.create(result)
  return Response.json({ ok: true }, { status: 201 })
}

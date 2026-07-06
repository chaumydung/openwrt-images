// Tests for the feedback API route: field validation, success path, and per-IP rate limiting.
// Calls the POST handler directly; getDb() resolves to the in-memory adapter (APP_MODE unset).
import { describe, expect, it } from 'vitest'
import { POST } from '@/app/api/feedback/route'

// Each test uses its own IP so the in-process rate limiter never bleeds between tests.
function post(body: unknown, ip: string) {
  return POST(
    new Request('http://localhost/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
}

const valid = { name: 'Alice', email: 'alice@example.com', message: 'Great tool!' }

describe('POST /api/feedback', () => {
  it('stores a valid submission and returns 201', async () => {
    const res = await post(valid, '10.0.0.1')
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('rejects a missing name with 400', async () => {
    const res = await post({ ...valid, name: '   ' }, '10.0.0.2')
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/name/i)
  })

  it('rejects a missing message with 400', async () => {
    const res = await post({ name: valid.name, email: valid.email }, '10.0.0.3')
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/message/i)
  })

  it('rejects a malformed email with 400', async () => {
    const res = await post({ ...valid, email: 'not-an-email' }, '10.0.0.4')
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/email/i)
  })

  it('rejects a message over 2000 characters with 400', async () => {
    const res = await post({ ...valid, message: 'x'.repeat(2001) }, '10.0.0.5')
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/2000/)
  })

  it('rejects a name over 100 characters with 400', async () => {
    const res = await post({ ...valid, name: 'x'.repeat(101) }, '10.0.0.6')
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/100/)
  })

  it('rejects invalid JSON with 400', async () => {
    const res = await post('{not json', '10.0.0.7')
    expect(res.status).toBe(400)
  })

  it('rate limits the 6th request from the same IP with 429', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await post(valid, '10.0.0.8')
      expect(res.status).toBe(201)
    }
    const res = await post(valid, '10.0.0.8')
    expect(res.status).toBe(429)
  })

  it('keeps counting other IPs independently of a limited IP', async () => {
    for (let i = 0; i < 6; i++) await post(valid, '10.0.0.9')
    const res = await post(valid, '10.0.0.10')
    expect(res.status).toBe(201)
  })
})

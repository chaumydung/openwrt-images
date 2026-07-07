// Tests for the executor layer: mock state machine, failure-hint detection, GitHub Actions
// dispatch payload / status mapping / webhook signature verification, and the factory.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { MockExecutor } from '../../src/lib/executor/mock'
import { GithubActionsExecutor, parseWorkflowRunWebhook } from '../../src/lib/executor/github'
import { detectFailureHint } from '../../src/lib/executor/types'
import { getExecutor } from '../../src/lib/executor'
import type { BuildSpec } from '../../src/lib/executor/types'

const spec = (packages: string[] = ['luci']): BuildSpec => ({
  distro: 'openwrt',
  version: '24.10.1',
  target: 'ramips/mt7621',
  profileId: 'xiaomi_mi-router-4a-gigabit',
  packages,
  config: { hostname: 'openwrt-test' },
  communityPackages: [],
  uiLanguage: 'en',
})

// Advance a mock job through queued(2) + building(3) and return the terminal status.
async function terminalStatus(exec: MockExecutor, externalId: string) {
  for (let i = 0; i < 5; i++) await exec.getStatus(externalId)
  return exec.getStatus(externalId)
}

describe('MockExecutor', () => {
  it('advances queued(2) → building(3) → success purely by poll count', async () => {
    const exec = new MockExecutor()
    const { externalId } = await exec.submit(spec())
    const states: string[] = []
    let previousLog = ''
    for (let i = 0; i < 6; i++) {
      const status = await exec.getStatus(externalId)
      states.push(status.state)
      if (status.state === 'building') {
        // Log text grows monotonically while building.
        expect((status.logText ?? '').length).toBeGreaterThan(previousLog.length)
        previousLog = status.logText ?? ''
      }
    }
    expect(states).toEqual(['queued', 'queued', 'building', 'building', 'building', 'success'])
  })

  it('returns a fake artifact with deterministic sha256 and ~7 day expiry on success', async () => {
    const exec = new MockExecutor()
    const { externalId } = await exec.submit(spec())
    const status = await terminalStatus(exec, externalId)
    expect(status.state).toBe('success')
    expect(status.artifact?.url).toContain(externalId)
    expect(status.artifact?.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(status.artifact?.sizeBytes).toBeGreaterThan(0)
    const ttl = new Date(status.artifact!.expiresAt!).getTime() - Date.now()
    expect(ttl).toBeGreaterThan(6.9 * 24 * 3600 * 1000)
    expect(ttl).toBeLessThanOrEqual(7 * 24 * 3600 * 1000)
  })

  it('mock-fail-conflict fails with a package-conflict hint and matching log', async () => {
    const exec = new MockExecutor()
    const { externalId } = await exec.submit(spec(['luci', 'mock-fail-conflict']))
    const status = await terminalStatus(exec, externalId)
    expect(status.state).toBe('failed')
    expect(status.failureHint).toBe('package-conflict')
    expect(status.logText).toContain('Cannot satisfy the following dependencies')
  })

  it('mock-fail-size fails with an image-too-big hint and matching log', async () => {
    const exec = new MockExecutor()
    const { externalId } = await exec.submit(spec(['luci', 'mock-fail-size']))
    const status = await terminalStatus(exec, externalId)
    expect(status.state).toBe('failed')
    expect(status.failureHint).toBe('image-too-big')
    expect(status.logText).toContain('is too big')
  })

  it('mock-timeout ends in timeout and stays there on further polls', async () => {
    const exec = new MockExecutor()
    const { externalId } = await exec.submit(spec(['mock-timeout']))
    const status = await terminalStatus(exec, externalId)
    expect(status.state).toBe('timeout')
    expect((await exec.getStatus(externalId)).state).toBe('timeout')
  })

  it('cancel forgets the job', async () => {
    const exec = new MockExecutor()
    const { externalId } = await exec.submit(spec())
    await exec.cancel(externalId)
    await expect(exec.getStatus(externalId)).rejects.toThrow('unknown mock build')
  })
})

describe('detectFailureHint', () => {
  it('detects opkg/apk dependency conflicts', () => {
    expect(detectFailureHint('Cannot satisfy the following dependencies for luci-app-foo')).toBe('package-conflict')
    expect(detectFailureHint('ERROR: unable to select packages: luci-app-foo')).toBe('package-conflict')
  })
  it('detects images exceeding flash size', () => {
    expect(detectFailureHint('WARNING: Image file x.bin is too big: 8912896 > 7929856')).toBe('image-too-big')
  })
  it('returns null for logs without a known pattern', () => {
    expect(detectFailureHint('make: *** [Makefile:1: image] Error 1')).toBeNull()
  })
})

describe('GithubActionsExecutor', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('BUILD_REPO', 'acme/owrt-builder')
    vi.stubEnv('BUILD_GITHUB_TOKEN', 'ghp_test')
    vi.stubEnv('R2_PUBLIC_BASE_URL', 'https://dl.example.com')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

  const run = (over: Partial<{ display_title: string; status: string; conclusion: string | null }>) => ({
    name: 'Build firmware',
    display_title: 'Build the-build-id',
    status: 'completed',
    conclusion: 'success',
    html_url: 'https://github.com/acme/owrt-builder/actions/runs/1',
    ...over,
  })

  it('submit dispatches the workflow with serialized inputs and returns the build_id', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    const { externalId } = await new GithubActionsExecutor().submit(spec(['luci', '-ppp']))
    expect(externalId).toMatch(/^[0-9a-f-]{36}$/)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.github.com/repos/acme/owrt-builder/actions/workflows/build-firmware.yml/dispatches')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ghp_test')
    const body = JSON.parse(init.body as string)
    expect(body.ref).toBe('main')
    expect(body.inputs.build_id).toBe(externalId)
    expect(body.inputs.distro).toBe('openwrt')
    expect(body.inputs.version).toBe('24.10.1')
    expect(body.inputs.target).toBe('ramips/mt7621')
    expect(body.inputs.profile).toBe('xiaomi_mi-router-4a-gigabit')
    expect(body.inputs.packages).toBe('luci -ppp')
    expect(JSON.parse(body.inputs.config_json)).toEqual({ hostname: 'openwrt-test' })
    expect(body.inputs.community_packages).toBe('[]')
    expect(body.inputs.ui_language).toBe('en')
  })

  it('submit forwards community_packages and ui_language when set', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await new GithubActionsExecutor().submit({
      ...spec(['luci']),
      communityPackages: ['openclash'],
      uiLanguage: 'zh-cn',
    })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.inputs.community_packages).toBe('["openclash"]')
    expect(body.inputs.ui_language).toBe('zh-cn')
  })

  it('submit throws on a non-2xx dispatch response', async () => {
    fetchMock.mockResolvedValueOnce(new Response('validation failed', { status: 422 }))
    await expect(new GithubActionsExecutor().submit(spec())).rejects.toThrow('422')
  })

  it('maps run states: missing → queued, queued → queued, in_progress → building', async () => {
    const exec = new GithubActionsExecutor()
    fetchMock.mockResolvedValueOnce(jsonResponse({ workflow_runs: [] }))
    expect((await exec.getStatus('the-build-id')).state).toBe('queued')
    fetchMock.mockResolvedValueOnce(jsonResponse({ workflow_runs: [run({ status: 'queued', conclusion: null })] }))
    expect((await exec.getStatus('the-build-id')).state).toBe('queued')
    fetchMock.mockResolvedValueOnce(jsonResponse({ workflow_runs: [run({ status: 'in_progress', conclusion: null })] }))
    const building = await exec.getStatus('the-build-id')
    expect(building.state).toBe('building')
    expect(building.logUrl).toContain('/actions/runs/1')
  })

  it('maps conclusions: failure → failed, timed_out → timeout', async () => {
    const exec = new GithubActionsExecutor()
    fetchMock.mockResolvedValueOnce(jsonResponse({ workflow_runs: [run({ conclusion: 'failure' })] }))
    const failed = await exec.getStatus('the-build-id')
    expect(failed.state).toBe('failed')
    expect(failed.logUrl).toContain('/actions/runs/1')
    fetchMock.mockResolvedValueOnce(jsonResponse({ workflow_runs: [run({ conclusion: 'timed_out' })] }))
    expect((await exec.getStatus('the-build-id')).state).toBe('timeout')
  })

  it('on success reads meta.json from the conventional R2 path and composes the artifact', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ workflow_runs: [run({})] }))
      .mockResolvedValueOnce(
        jsonResponse({
          buildId: 'the-build-id',
          file: 'firmware-squashfs-sysupgrade.bin',
          sha256: 'ab'.repeat(32),
          sizeBytes: 8388608,
          expiresAt: '2026-07-13T00:00:00Z',
        }),
      )
    const status = await new GithubActionsExecutor().getStatus('the-build-id')
    expect(status.state).toBe('success')
    expect(fetchMock.mock.calls[1][0]).toBe('https://dl.example.com/builds/the-build-id/meta.json')
    expect(status.artifact).toEqual({
      url: 'https://dl.example.com/builds/the-build-id/firmware-squashfs-sysupgrade.bin',
      sha256: 'ab'.repeat(32),
      sizeBytes: 8388608,
      expiresAt: '2026-07-13T00:00:00Z',
    })
  })

  it('on success with missing meta.json still reports success without an artifact', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ workflow_runs: [run({})] }))
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))
    const status = await new GithubActionsExecutor().getStatus('the-build-id')
    expect(status.state).toBe('success')
    expect(status.artifact).toBeUndefined()
  })
})

describe('parseWorkflowRunWebhook', () => {
  const secret = 'test-webhook-secret'
  const payload = JSON.stringify({
    action: 'completed',
    workflow_run: { name: 'Build firmware', display_title: 'Build abc-123', conclusion: 'success' },
  })
  const sign = (body: string, key = secret) => `sha256=${createHmac('sha256', key).update(body).digest('hex')}`

  it('accepts a valid signature and extracts build id + conclusion', () => {
    expect(parseWorkflowRunWebhook(payload, sign(payload), secret)).toEqual({
      buildId: 'abc-123',
      conclusion: 'success',
    })
  })

  it('rejects wrong secret, tampered payload, and missing/malformed header', () => {
    expect(parseWorkflowRunWebhook(payload, sign(payload, 'other-secret'), secret)).toBeNull()
    expect(parseWorkflowRunWebhook(payload + ' ', sign(payload), secret)).toBeNull()
    expect(parseWorkflowRunWebhook(payload, null, secret)).toBeNull()
    expect(parseWorkflowRunWebhook(payload, 'sha1=deadbeef', secret)).toBeNull()
  })

  it('ignores runs that are not firmware builds', () => {
    const other = JSON.stringify({ workflow_run: { name: 'CI', display_title: 'CI run', conclusion: 'success' } })
    expect(parseWorkflowRunWebhook(other, sign(other), secret)).toBeNull()
  })
})

describe('MockExecutor community packages', () => {
  it('mock log echoes selected community packages', async () => {
    const exec = new MockExecutor()
    const testSpec = spec(['luci'])
    const { externalId } = await exec.submit({ ...testSpec, communityPackages: ['openclash'], uiLanguage: 'en' })
    let log = ''
    for (let i = 0; i < 6; i++) log = (await exec.getStatus(externalId)).logText ?? log
    expect(log).toContain('community add-ons: openclash')
  })

  it('mock log echoes multiple community packages', async () => {
    const exec = new MockExecutor()
    const testSpec = spec(['luci'])
    const { externalId } = await exec.submit({ ...testSpec, communityPackages: ['openclash', 'smartdns'], uiLanguage: 'en' })
    let log = ''
    for (let i = 0; i < 6; i++) log = (await exec.getStatus(externalId)).logText ?? log
    expect(log).toContain('community add-ons: openclash, smartdns')
  })

  it('mock log includes ui language when non-en', async () => {
    const exec = new MockExecutor()
    const testSpec = spec(['luci'])
    const { externalId } = await exec.submit({ ...testSpec, communityPackages: ['openclash'], uiLanguage: 'zh-cn' })
    let log = ''
    for (let i = 0; i < 6; i++) log = (await exec.getStatus(externalId)).logText ?? log
    expect(log).toContain('community add-ons: openclash')
    expect(log).toContain('(ui language: zh-cn)')
  })
})

describe('getExecutor', () => {
  it('returns the mock executor unless APP_MODE is explicitly real', () => {
    vi.stubEnv('APP_MODE', 'mock')
    expect(getExecutor()).toBeInstanceOf(MockExecutor)
    expect(getExecutor()).toBe(getExecutor()) // singleton
    vi.unstubAllEnvs()
  })
})

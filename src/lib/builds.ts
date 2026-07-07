// Build business service (PRD §2/§3.3/§6): validates build requests against the device
// catalog and the config-field whitelist, submits builds under the daily quota and global
// concurrency cap, and syncs executor status back to the DB with refund-once semantics.
import { getCatalog } from '@/lib/catalog'
import { communityIds, SUPPORTED_LANGUAGES } from '@/lib/community-packages'
import { getDb } from '@/lib/db'
import type { Build, BuildStatus, BuildUpdate } from '@/lib/db'
import { getExecutor } from '@/lib/executor'
import type { BuildConfig, BuildSpec, ExecutorStatus, FailureHint } from '@/lib/executor'
import { checkAndConsume, quotaResetAt, refund } from '@/lib/quota'

const MAX_PACKAGES = 200
// ImageBuilder package names (leading `-` excludes a default package); rejects shell metacharacters.
const PACKAGE_RE = /^-?[a-zA-Z0-9._+-]+$/
// Global concurrency cap (PRD §6): beyond this, new builds are shown a queue position.
const MAX_CONCURRENT = 10
const TERMINAL_STATUSES: BuildStatus[] = ['success', 'failed', 'timeout']

// ── Request validation ───────────────────────────────────────────────

// RFC 952 (relaxed): letters/digits/hyphens, no leading/trailing hyphen, max 63 chars.
const HOSTNAME_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p))) return false
  const [a, b, c, d] = parts.map(Number)
  if ([a, b, c, d].some((n) => n > 255)) return false
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

// Per-field validators for the PRD §3.3 whitelist. This record IS the whitelist — any other
// config key is rejected outright in validateBuildRequest.
const CONFIG_VALIDATORS: Record<keyof BuildConfig, (value: string) => string | null> = {
  hostname: (v) =>
    v.length > 63 || !HOSTNAME_RE.test(v)
      ? 'hostname must be 1-63 letters, digits or hyphens and cannot start or end with a hyphen'
      : null,
  timezone: (v) => (v.trim() === '' || v.length > 64 ? 'timezone must be a non-empty string of at most 64 characters' : null),
  lanIp: (v) =>
    isPrivateIpv4(v) ? null : 'lanIp must be a private IPv4 address (10.x.x.x, 172.16-31.x.x or 192.168.x.x)',
  rootPassword: (v) => (v.length > 63 ? 'rootPassword must be at most 63 characters' : null),
  wifiSsid: (v) => (v.trim() === '' || v.length > 32 ? 'wifiSsid must be a non-empty string of at most 32 characters' : null),
  wifiPassword: (v) => (v.length > 63 ? 'wifiPassword must be at most 63 characters' : null),
}

const WHITELIST = Object.keys(CONFIG_VALIDATORS).join(', ')

// Lazy index of every real (distro, version, target, profileId) combination in the catalog.
let comboCache: Set<string> | null = null
function validCombos(): Set<string> {
  if (!comboCache) {
    comboCache = new Set()
    for (const device of getCatalog().devices) {
      for (const b of device.builds) comboCache.add(`${b.distro}|${b.version}|${b.target}|${b.profileId}`)
    }
  }
  return comboCache
}

export type ValidationResult = { ok: true; spec: BuildSpec } | { ok: false; error: string }

/** Validates an untrusted request body into a BuildSpec, or explains the first problem found. */
export function validateBuildRequest(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Request body must be a JSON object' }
  const {
    distro, version, target, profileId,
    packages = [], config = {},
    communityPackages = [], uiLanguage = 'en',
  } = body as Record<string, unknown>

  if (distro !== 'openwrt' && distro !== 'immortalwrt') {
    return { ok: false, error: 'distro must be "openwrt" or "immortalwrt"' }
  }
  if (typeof version !== 'string' || typeof target !== 'string' || typeof profileId !== 'string') {
    return { ok: false, error: 'version, target and profileId are required strings' }
  }
  if (!validCombos().has(`${distro}|${version}|${target}|${profileId}`)) {
    return {
      ok: false,
      error: `Unknown device: ${distro} ${version} ${target} "${profileId}" is not in the catalog`,
    }
  }

  if (!Array.isArray(packages)) return { ok: false, error: 'packages must be an array of package names' }
  if (packages.length > MAX_PACKAGES) return { ok: false, error: `packages must contain at most ${MAX_PACKAGES} entries` }
  for (const pkg of packages) {
    if (typeof pkg !== 'string' || !PACKAGE_RE.test(pkg)) {
      return { ok: false, error: `Invalid package name: ${JSON.stringify(pkg)}` }
    }
  }

  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    return { ok: false, error: 'config must be an object' }
  }
  const cleanConfig: BuildConfig = {}
  for (const [key, value] of Object.entries(config)) {
    if (!(key in CONFIG_VALIDATORS)) {
      // PRD §3.3 hard constraint: reject explicitly rather than silently strip, so callers
      // learn the boundary instead of believing the field was applied.
      return {
        ok: false,
        error:
          `Config field "${key}" is not accepted. Only ${WHITELIST} are supported — ` +
          'build inputs and logs are public, so fields that reference external accounts or ' +
          'open public-network entry points (proxy subscriptions, DDNS, PPPoE credentials, ' +
          'VPN keys, port forwards) are never collected.',
      }
    }
    if (typeof value !== 'string') return { ok: false, error: `Config field "${key}" must be a string` }
    const error = CONFIG_VALIDATORS[key as keyof BuildConfig](value)
    if (error) return { ok: false, error }
    cleanConfig[key as keyof BuildConfig] = value
  }

  if (!Array.isArray(communityPackages)) {
    return { ok: false, error: 'communityPackages must be an array of add-on ids' }
  }
  const ids = communityIds()
  for (const id of communityPackages) {
    if (typeof id !== 'string' || !ids.has(id)) {
      return { ok: false, error: `Unknown community add-on: ${JSON.stringify(id)}. Only catalog ids are accepted.` }
    }
  }
  if (typeof uiLanguage !== 'string' || !SUPPORTED_LANGUAGES.includes(uiLanguage as never)) {
    return { ok: false, error: `Unsupported UI language: ${JSON.stringify(uiLanguage)}` }
  }

  return {
    ok: true,
    spec: {
      distro, version, target, profileId,
      packages: packages as string[], config: cleanConfig,
      communityPackages: communityPackages as string[], uiLanguage,
    },
  }
}

// ── Submission ───────────────────────────────────────────────────────

export type SubmitResult =
  | { ok: true; id: string; queuePosition: number }
  | { ok: false; code: 'quota'; resetAt: Date }
  | { ok: false; code: 'executor' }

/** Submits a validated build for a user: quota check → DB record → executor dispatch. */
export async function submitBuild(userId: string, spec: BuildSpec): Promise<SubmitResult> {
  const db = getDb()
  // V1 simplification: the executor (GitHub Actions) does its own queueing, so we always
  // submit immediately and the position is display-only (0 = a slot is free). V2 migration
  // point: hold submission here until a slot frees (self-hosted runner / VPS job queue).
  const active = await db.builds.listActiveCount()
  const queuePosition = Math.max(0, active + 1 - MAX_CONCURRENT)

  const quota = await checkAndConsume(userId)
  if (!quota.allowed) return { ok: false, code: 'quota', resetAt: quota.resetAt }

  // db.BuildSpec names the field `profile`; the executor names it `profileId`.
  const build = await db.builds.create({ userId, spec: { ...spec, profile: spec.profileId } })
  try {
    const { externalId } = await getExecutor().submit(spec)
    await db.builds.updateStatus(build.id, { externalId, queuePosition })
  } catch {
    // Systemic failure before the build ever started — refund the day's quota (PRD §2).
    await refund(userId, quota.day)
    await db.builds.updateStatus(build.id, {
      status: 'failed',
      failureReason: 'executor-error',
      quotaRefunded: true,
    })
    return { ok: false, code: 'executor' }
  }
  return { ok: true, id: build.id, queuePosition }
}

// ── Status ───────────────────────────────────────────────────────────

export type BuildStatusView = {
  id: string
  status: BuildStatus
  queuePosition: number | null
  /** Full build log text when the executor holds it in-process (mock). */
  log: string | null
  /** Link to externally hosted logs (GitHub Actions run page). */
  logUrl: string | null
  artifact: { url: string; sha256?: string; sizeBytes?: number; expiresAt?: string } | null
  artifactExpiresAt: string | null
  failureHint: FailureHint
  quotaRefunded: boolean
  /** Present on a non-refunded failure: when the user can build again. */
  quotaResetAt?: string
}

export type StatusResult = { ok: true; view: BuildStatusView } | { ok: false; code: 'not-found' | 'forbidden' }

/** Returns the current status of the caller's own build, syncing executor state into the DB. */
export async function getBuildStatus(buildId: string, userId: string): Promise<StatusResult> {
  const build = await getDb().builds.get(buildId)
  if (!build) return { ok: false, code: 'not-found' }
  if (build.userId !== userId) return { ok: false, code: 'forbidden' }

  let status: ExecutorStatus | null = null
  if (build.externalId) {
    try {
      status = await getExecutor().getStatus(build.externalId)
    } catch {
      // Executor unreachable (or an in-process mock lost the job after a restart):
      // fall back to the last DB snapshot instead of failing the request.
    }
  }
  const synced = status ? await syncFromExecutor(build, status) : build
  return { ok: true, view: toView(synced, status) }
}

async function syncFromExecutor(build: Build, status: ExecutorStatus): Promise<Build> {
  const patch: BuildUpdate = {}
  if (status.state !== build.status) patch.status = status.state
  if (status.logUrl && status.logUrl !== build.logUrl) patch.logUrl = status.logUrl
  if (status.artifact && status.artifact.url !== build.artifactUrl) {
    patch.artifactUrl = status.artifact.url
    if (status.artifact.expiresAt) patch.artifactExpiresAt = new Date(status.artifact.expiresAt)
  }
  if (status.failureHint && status.failureHint !== build.failureReason) patch.failureReason = status.failureHint

  // Refund exactly once, and only for systemic failures — timeout or an executor-side error.
  // User-caused failures (package conflict / image too big) never refund (PRD §2).
  const systemic = status.state === 'timeout' || (status.state === 'failed' && !status.failureHint)
  if (systemic && !build.quotaRefunded) {
    await refund(build.userId, build.createdAt.toISOString().slice(0, 10))
    patch.quotaRefunded = true
  }

  if (Object.keys(patch).length === 0) return build
  return (await getDb().builds.updateStatus(build.id, patch)) ?? build
}

function toView(build: Build, status: ExecutorStatus | null): BuildStatusView {
  const artifact =
    status?.artifact ??
    (build.artifactUrl
      ? { url: build.artifactUrl, expiresAt: build.artifactExpiresAt?.toISOString() }
      : null)
  const failureHint =
    status?.failureHint ??
    (build.failureReason === 'package-conflict' || build.failureReason === 'image-too-big'
      ? build.failureReason
      : null)
  const view: BuildStatusView = {
    id: build.id,
    status: build.status,
    queuePosition: build.status === 'queued' ? build.queuePosition : null,
    log: status?.logText ?? null,
    logUrl: status?.logUrl ?? build.logUrl,
    artifact,
    artifactExpiresAt: artifact?.expiresAt ?? null,
    failureHint,
    quotaRefunded: build.quotaRefunded,
  }
  if (TERMINAL_STATUSES.includes(build.status) && build.status !== 'success' && !build.quotaRefunded) {
    view.quotaResetAt = quotaResetAt().toISOString()
  }
  return view
}

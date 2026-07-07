// Pure logic for the homepage firmware builder: client-side config validation mirroring
// the /api/builds rules, package token operations, step completion, and request assembly.

export type DistroId = 'openwrt' | 'immortalwrt'

export const DISTRO_LABELS: Record<string, string> = { openwrt: 'OpenWrt', immortalwrt: 'ImmortalWrt' }

export type DistroOption = { id: DistroId; label: string; version: string }

export type DeviceBuildRef = { distro: DistroId; version: string; target: string; profileId: string }

// Compact device shape served by /api/device-index (catalog devices without image lists).
export type BuilderDevice = {
  slug: string
  vendor: string
  model: string
  variant: string | null
  builds: DeviceBuildRef[]
}

export type BuilderConfig = {
  hostname: string
  timezone: string
  lanIp: string
  rootPassword: string
  wifiSsid: string
  wifiPassword: string
}

export const EMPTY_CONFIG: BuilderConfig = {
  hostname: '',
  timezone: '',
  lanIp: '',
  rootPassword: '',
  wifiSsid: '',
  wifiPassword: '',
}

export type SubmitError =
  | { kind: 'signin'; signInUrl: string }
  | { kind: 'quota'; resetAt: string }
  | { kind: 'message'; text: string }

// ── Config validation (mirrors CONFIG_VALIDATORS in src/lib/builds.ts) ──────────────

const HOSTNAME_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p))) return false
  const [a, b, c, d] = parts.map(Number)
  if ([a, b, c, d].some((n) => n > 255)) return false
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

// Passwords keep leading/trailing spaces (legal in WPA passphrases); everything else is trimmed.
const TRIMMED_FIELDS: readonly (keyof BuilderConfig)[] = ['hostname', 'timezone', 'lanIp', 'wifiSsid']

/** Validates one field the way the API will; empty means "not set" and is always valid. */
export function validateConfigField(field: keyof BuilderConfig, raw: string): string | null {
  const value = TRIMMED_FIELDS.includes(field) ? raw.trim() : raw
  if (value === '') return null
  switch (field) {
    case 'hostname':
      return value.length > 63 || !HOSTNAME_RE.test(value)
        ? 'Use letters, digits and hyphens (max 63 characters); cannot start or end with a hyphen.'
        : null
    case 'timezone':
      return value.length > 64 ? 'Max 64 characters.' : null
    case 'lanIp':
      return isPrivateIpv4(value)
        ? null
        : 'Enter a private IPv4 address (10.x.x.x, 172.16-31.x.x or 192.168.x.x).'
    case 'wifiSsid':
      return value.length > 32 ? 'Max 32 characters.' : null
    case 'rootPassword':
    case 'wifiPassword':
      return value.length > 63 ? 'Max 63 characters.' : null
  }
}

export function validateConfig(config: BuilderConfig): Partial<Record<keyof BuilderConfig, string>> {
  const errors: Partial<Record<keyof BuilderConfig, string>> = {}
  for (const field of Object.keys(config) as (keyof BuilderConfig)[]) {
    const error = validateConfigField(field, config[field])
    if (error) errors[field] = error
  }
  return errors
}

// ── Package tokens (a leading "-" excludes a default package, ImageBuilder syntax) ──

const PACKAGE_TOKEN_RE = /^-?[a-zA-Z0-9._+-]+$/

export function isValidPackageToken(token: string): boolean {
  return PACKAGE_TOKEN_RE.test(token)
}

function counterpart(token: string): string {
  return token.startsWith('-') ? token.slice(1) : `-${token}`
}

/** Adds a token, dropping its include/exclude counterpart ("pkg" vs "-pkg"). */
export function addPackageToken(list: string[], token: string): string[] {
  if (list.includes(token)) return list
  return [...list.filter((t) => t !== counterpart(token)), token]
}

export function removePackageToken(list: string[], token: string): string[] {
  return list.filter((t) => t !== token)
}

export function applyPreset(list: string[], packages: string[]): string[] {
  return packages.reduce(addPackageToken, list)
}

export function removePreset(list: string[], packages: string[]): string[] {
  return list.filter((t) => !packages.includes(t))
}

export function isPresetApplied(list: string[], packages: string[]): boolean {
  return packages.length > 0 && packages.every((p) => list.includes(p))
}

// ── Steps ───────────────────────────────────────────────────────────────────────────

export type BuilderStep = 1 | 2 | 3 | 4

export const STEP_LABELS: Record<BuilderStep, string> = {
  1: 'Distro & version',
  2: 'Device',
  3: 'Packages',
  4: 'Configure & build',
}

export function selectedBuild(device: BuilderDevice | null, distro: DistroId): DeviceBuildRef | null {
  return device?.builds.find((b) => b.distro === distro) ?? null
}

export type BuilderSelection = { distro: DistroId; device: BuilderDevice | null; config: BuilderConfig }

export function stepComplete(step: BuilderStep, sel: BuilderSelection): boolean {
  switch (step) {
    case 1:
      return true // distro always has a default
    case 2:
      return selectedBuild(sel.device, sel.distro) !== null
    case 3:
      return true // packages are optional
    case 4:
      return Object.keys(validateConfig(sel.config)).length === 0
  }
}

/** A step is reachable only when every earlier step is complete. */
export function canEnterStep(step: BuilderStep, sel: BuilderSelection): boolean {
  for (let s = 1; s < step; s++) {
    if (!stepComplete(s as BuilderStep, sel)) return false
  }
  return true
}

// ── Request assembly ────────────────────────────────────────────────────────────────

export type BuildRequestBody = {
  distro: DistroId
  version: string
  target: string
  profileId: string
  packages?: string[]
  config?: Partial<BuilderConfig>
  communityPackages?: string[]
  uiLanguage?: string
}

/** Assembles the POST /api/builds body; null when the selection has no matching build. */
export function buildRequestBody(sel: {
  distro: DistroId
  device: BuilderDevice | null
  packages: string[]
  config: BuilderConfig
  communityPackages?: string[]
  uiLanguage?: string
}): BuildRequestBody | null {
  const build = selectedBuild(sel.device, sel.distro)
  if (!build) return null
  const body: BuildRequestBody = {
    distro: build.distro,
    version: build.version,
    target: build.target,
    profileId: build.profileId,
  }
  if (sel.packages.length > 0) body.packages = sel.packages
  const config: Partial<BuilderConfig> = {}
  for (const field of Object.keys(sel.config) as (keyof BuilderConfig)[]) {
    const value = TRIMMED_FIELDS.includes(field) ? sel.config[field].trim() : sel.config[field]
    if (value !== '') config[field] = value
  }
  if (Object.keys(config).length > 0) body.config = config
  if (sel.communityPackages && sel.communityPackages.length > 0) body.communityPackages = sel.communityPackages
  if (sel.uiLanguage && sel.uiLanguage !== 'en') body.uiLanguage = sel.uiLanguage
  return body
}

// ── Package browsing ────────────────────────────────────────────────────────────────

export type PackageInfo = {
  name: string
  version: string
  section: string
  sizeBytes: number
  description: string
  feed: string
}

export type PackageCategoryInfo = { name: string; packages: PackageInfo[] }

/** Case-insensitive name/description filter across all categories; name hits rank first. */
export function filterPackages(categories: PackageCategoryInfo[], query: string): PackageInfo[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const matches: PackageInfo[] = []
  for (const category of categories) {
    for (const pkg of category.packages) {
      if (pkg.name.toLowerCase().includes(q) || pkg.description.toLowerCase().includes(q)) matches.push(pkg)
    }
  }
  return matches.sort((a, b) => {
    const an = a.name.toLowerCase().includes(q) ? 0 : 1
    const bn = b.name.toLowerCase().includes(q) ? 0 : 1
    return an - bn || a.name.length - b.name.length || a.name.localeCompare(b.name)
  })
}

// ── Formatting ──────────────────────────────────────────────────────────────────────

export function formatSize(bytes: number): string {
  if (bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** "in 3h 12m" until the given ISO timestamp; "now" once it has passed. */
export function relativeUntil(iso: string, now: Date = new Date()): string {
  const diff = new Date(iso).getTime() - now.getTime()
  if (diff <= 0) return 'now'
  const minutes = Math.ceil(diff / 60000)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`
}

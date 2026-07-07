// Executor abstraction (PRD §6): the web layer submits builds, polls status, and fetches
// artifacts through this interface without knowing the concrete backend (mock or GitHub Actions).

/**
 * Whitelisted base-config fields (PRD §3.3 hard constraint). This whitelist IS the complete
 * interface — never add fields that reference external accounts or create public-network
 * entry points (proxy subscription URLs, DDNS tokens, PPPoE credentials, VPN keys, port
 * forwards), and never add a passthrough/extension field.
 */
export type BuildConfig = {
  hostname?: string
  timezone?: string
  lanIp?: string
  rootPassword?: string
  wifiSsid?: string
  wifiPassword?: string
}

export type BuildSpec = {
  distro: 'openwrt' | 'immortalwrt'
  version: string
  target: string
  profileId: string
  /** ImageBuilder package list; a leading `-` excludes a default package (e.g. `-ppp`). */
  packages: string[]
  config: BuildConfig
  /** Vetted community add-on ids (data/packages/community.json). Never arbitrary URLs (PRD §3.3). */
  communityPackages: string[]
  /** UI language; 'en' (default) installs no i18n packages. One of SUPPORTED_LANGUAGES. */
  uiLanguage: string
}

export type ExecutorState = 'queued' | 'building' | 'success' | 'failed' | 'timeout'

export type FailureHint = 'package-conflict' | 'image-too-big' | null

export type BuildArtifact = {
  url: string
  sha256?: string
  sizeBytes?: number
  expiresAt?: string
}

export type ExecutorStatus = {
  state: ExecutorState
  /** Full log text when the executor holds it in-process (mock). */
  logText?: string
  /** Link to externally hosted logs (GitHub Actions run page). */
  logUrl?: string
  artifact?: BuildArtifact
  /** Auto-detected hint for the two most common build failures. */
  failureHint?: FailureHint
}

export interface Executor {
  submit(spec: BuildSpec): Promise<{ externalId: string }>
  getStatus(externalId: string): Promise<ExecutorStatus>
  cancel?(externalId: string): Promise<void>
}

// The two most common ImageBuilder failures (see CLAUDE.md): package dependency conflicts
// (opkg/apk resolver errors) and images exceeding the device flash size.
const CONFLICT_PATTERNS = [
  /cannot satisfy the following dependencies/i, // opkg resolver
  /unable to select packages/i, // apk resolver (newer releases)
  /cannot find dependency/i,
]
const TOO_BIG_PATTERN = /is too big/i

export function detectFailureHint(logText: string): FailureHint {
  if (CONFLICT_PATTERNS.some((re) => re.test(logText))) return 'package-conflict'
  if (TOO_BIG_PATTERN.test(logText)) return 'image-too-big'
  return null
}

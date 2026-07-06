// Pure presentation logic for the build status page (no React): status→badge mapping,
// failure-hint copy, polling decisions and artifact formatting. Kept side-effect free
// so it is unit-testable in a plain node environment.

export type BuildStatus = 'queued' | 'building' | 'success' | 'failed' | 'timeout'
export type FailureHint = 'package-conflict' | 'image-too-big' | null

/** Response shape of GET /api/builds/[id] (contract owned by src/lib/builds.ts). */
export type BuildView = {
  id: string
  status: BuildStatus
  queuePosition: number | null
  log: string | null
  logUrl: string | null
  artifact: { url: string; sha256?: string; sizeBytes?: number; expiresAt?: string } | null
  artifactExpiresAt: string | null
  failureHint: FailureHint
  quotaRefunded: boolean
  quotaResetAt?: string
}

export const POLL_INTERVAL_MS = 3000

// DESIGN.md status badges: small dot + text, mono font.
// queued amber / building sky / success green / failed & timeout red.
const BADGES: Record<BuildStatus, { label: string; dotClass: string; textClass: string }> = {
  queued: { label: 'Queued', dotClass: 'bg-amber-700', textClass: 'text-amber-700' },
  building: { label: 'Building', dotClass: 'bg-sky-700', textClass: 'text-sky-700' },
  success: { label: 'Success', dotClass: 'bg-green-700', textClass: 'text-green-700' },
  failed: { label: 'Failed', dotClass: 'bg-red-700', textClass: 'text-red-700' },
  timeout: { label: 'Timed out', dotClass: 'bg-red-700', textClass: 'text-red-700' },
}

export function statusBadge(status: BuildStatus): { label: string; dotClass: string; textClass: string } {
  return BADGES[status]
}

/** Whether the page should keep polling: only non-terminal states do. */
export function shouldKeepPolling(status: BuildStatus): boolean {
  return status === 'queued' || status === 'building'
}

/** Queue position line for the queued state (0 = a build slot is free). */
export function queueLabel(position: number): string {
  return position <= 0 ? 'Starting soon' : `Position in queue: ${position}`
}

// Human explanations for the two most common ImageBuilder failures (PRD §3.2).
const HINT_COPY: Record<Exclude<FailureHint, null>, { title: string; body: string }> = {
  'package-conflict': {
    title: 'Package dependency conflict',
    body: 'Some of the selected packages cannot be installed together. Remove the conflicting package named in the log below, or reduce your package selection, then start a new build.',
  },
  'image-too-big': {
    title: 'Image exceeds device flash capacity',
    body: 'The resulting firmware image is larger than the flash storage of this device. Remove some packages, or build for a device with more storage.',
  },
}

export function failureHintCopy(hint: FailureHint): { title: string; body: string } | null {
  return hint ? HINT_COPY[hint] : null
}

/** Analytics reason for a terminal failure (build_failed event payload). */
export function failureReason(status: BuildStatus, hint: FailureHint): string {
  if (hint) return hint
  return status === 'timeout' ? 'timeout' : 'executor-error'
}

/**
 * Localized artifact expiry, e.g. "Jul 14, 2026, 8:00 AM". The timeZone override
 * exists only so tests are deterministic; the page uses the visitor's zone.
 */
export function formatExpiresAt(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone })
}

/** "8.0 MB"-style size; firmware artifacts are MB-scale, small ones fall back to KB. */
export function formatSizeBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** File name portion of the artifact download URL (for the checksum example). */
export function artifactFilename(url: string): string {
  const path = url.split(/[?#]/)[0]
  return path.slice(path.lastIndexOf('/') + 1) || 'firmware.bin'
}

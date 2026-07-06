// Unit tests for the build status page's pure presentation logic (src/app/builds/[id]/lib.ts).
import { describe, expect, it } from 'vitest'
import {
  artifactFilename,
  failureHintCopy,
  failureReason,
  formatExpiresAt,
  formatSizeBytes,
  queueLabel,
  shouldKeepPolling,
  statusBadge,
} from '@/app/builds/[id]/lib'

describe('statusBadge', () => {
  it('maps every status to the DESIGN.md badge color and label', () => {
    expect(statusBadge('queued')).toEqual({ label: 'Queued', dotClass: 'bg-amber-700', textClass: 'text-amber-700' })
    expect(statusBadge('building')).toEqual({ label: 'Building', dotClass: 'bg-sky-700', textClass: 'text-sky-700' })
    expect(statusBadge('success')).toEqual({ label: 'Success', dotClass: 'bg-green-700', textClass: 'text-green-700' })
  })

  it('renders failed and timeout with red but distinct labels', () => {
    expect(statusBadge('failed')).toEqual({ label: 'Failed', dotClass: 'bg-red-700', textClass: 'text-red-700' })
    expect(statusBadge('timeout')).toEqual({ label: 'Timed out', dotClass: 'bg-red-700', textClass: 'text-red-700' })
  })
})

describe('shouldKeepPolling', () => {
  it('keeps polling while the build is queued or building', () => {
    expect(shouldKeepPolling('queued')).toBe(true)
    expect(shouldKeepPolling('building')).toBe(true)
  })

  it('stops polling on every terminal state', () => {
    expect(shouldKeepPolling('success')).toBe(false)
    expect(shouldKeepPolling('failed')).toBe(false)
    expect(shouldKeepPolling('timeout')).toBe(false)
  })
})

describe('queueLabel', () => {
  it('shows "Starting soon" when a build slot is free (position 0)', () => {
    expect(queueLabel(0)).toBe('Starting soon')
  })

  it('shows the numeric queue position otherwise', () => {
    expect(queueLabel(1)).toBe('Position in queue: 1')
    expect(queueLabel(7)).toBe('Position in queue: 7')
  })
})

describe('failureHintCopy', () => {
  it('explains a package dependency conflict in plain language', () => {
    const copy = failureHintCopy('package-conflict')
    expect(copy?.title).toBe('Package dependency conflict')
    expect(copy?.body).toMatch(/remove the conflicting package|reduce your package selection/i)
  })

  it('explains an oversized image in plain language', () => {
    const copy = failureHintCopy('image-too-big')
    expect(copy?.title).toBe('Image exceeds device flash capacity')
    expect(copy?.body).toMatch(/remove some packages|more storage/i)
  })

  it('returns null when there is no hint', () => {
    expect(failureHintCopy(null)).toBeNull()
  })
})

describe('failureReason', () => {
  it('prefers the failure hint, then timeout, then a generic executor error', () => {
    expect(failureReason('failed', 'package-conflict')).toBe('package-conflict')
    expect(failureReason('failed', 'image-too-big')).toBe('image-too-big')
    expect(failureReason('timeout', null)).toBe('timeout')
    expect(failureReason('failed', null)).toBe('executor-error')
  })
})

describe('formatExpiresAt', () => {
  it('formats the ISO timestamp as a readable localized date-time', () => {
    // \s tolerates the narrow no-break space some ICU versions emit before AM/PM.
    expect(formatExpiresAt('2026-07-14T08:00:00.000Z', 'UTC')).toMatch(/^Jul 14, 2026, 8:00\sAM$/)
  })
})

describe('formatSizeBytes', () => {
  it('formats MB-scale artifacts with one decimal and small ones as KB', () => {
    expect(formatSizeBytes(8388608)).toBe('8.0 MB')
    expect(formatSizeBytes(5033165)).toBe('4.8 MB')
    expect(formatSizeBytes(512000)).toBe('500 KB')
  })
})

describe('artifactFilename', () => {
  it('extracts the file name and strips query strings', () => {
    expect(artifactFilename('https://cdn.example/builds/abc/device-squashfs-sysupgrade.bin')).toBe(
      'device-squashfs-sysupgrade.bin',
    )
    expect(artifactFilename('https://cdn.example/fw.bin?X-Sig=abc#frag')).toBe('fw.bin')
  })

  it('falls back to a generic name when the URL has no file part', () => {
    expect(artifactFilename('https://cdn.example/builds/')).toBe('firmware.bin')
  })
})

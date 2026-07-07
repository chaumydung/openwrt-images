// Mock executor (APP_MODE=mock): deterministic in-process state machine that advances per
// getStatus() poll — no real time, no network — so unit tests and E2E runs are reproducible.
// Special trigger packages: mock-fail-conflict / mock-fail-size / mock-timeout.
import { createHash, randomUUID } from 'node:crypto'
import { detectFailureHint } from './types'
import type { BuildSpec, Executor, ExecutorStatus } from './types'

const TRIGGER_CONFLICT = 'mock-fail-conflict'
const TRIGGER_SIZE = 'mock-fail-size'
const TRIGGER_TIMEOUT = 'mock-timeout'

const QUEUED_POLLS = 2
const BUILDING_POLLS = 3
const ARTIFACT_TTL_MS = 7 * 24 * 60 * 60 * 1000

function buildLogLines(spec: BuildSpec): string[] {
  const lines = [
    `Downloading ${spec.distro}-imagebuilder-${spec.version}-${spec.target.replace('/', '-')}.Linux-x86_64.tar.zst`,
    `make image PROFILE="${spec.profileId}" PACKAGES="${spec.packages.join(' ')}"`,
    'Checking configuration files...',
  ]
  if (spec.communityPackages.length > 0) {
    lines.push(`Installing community add-ons: ${spec.communityPackages.join(', ')}` +
      (spec.uiLanguage !== 'en' ? ` (ui language: ${spec.uiLanguage})` : ''))
  }
  lines.push(
    'Installing packages...',
    'Generating firmware images...',
    'Calculating sha256 checksums... done',
  )
  return lines
}

function finalStatus(externalId: string, spec: BuildSpec): ExecutorStatus {
  const log = buildLogLines(spec)
  if (spec.packages.includes(TRIGGER_TIMEOUT)) {
    return {
      state: 'timeout',
      logText: [...log.slice(0, 4), 'Error: the build exceeded the 30 minute limit and was cancelled'].join('\n'),
    }
  }
  if (spec.packages.includes(TRIGGER_CONFLICT)) {
    const logText = [
      ...log.slice(0, 4),
      'Collected errors:',
      ` * satisfy_dependencies_for: Cannot satisfy the following dependencies for ${TRIGGER_CONFLICT}:`,
      ' *      libmock (>= 1.0)',
      'make: *** [Makefile:196: package_install] Error 255',
    ].join('\n')
    return { state: 'failed', logText, failureHint: detectFailureHint(logText) }
  }
  if (spec.packages.includes(TRIGGER_SIZE)) {
    const logText = [
      ...log.slice(0, 5),
      `WARNING: Image file ${spec.profileId}-squashfs-sysupgrade.bin is too big: 8912896 > 7929856`,
      'make: *** [Makefile:87: build_image] Error 1',
    ].join('\n')
    return { state: 'failed', logText, failureHint: detectFailureHint(logText) }
  }
  return {
    state: 'success',
    logText: log.join('\n'),
    artifact: {
      url: `https://mock.invalid/builds/${externalId}/${spec.profileId}-squashfs-sysupgrade.bin`,
      // Deterministic fake checksum derived from the spec itself.
      sha256: createHash('sha256').update(JSON.stringify(spec)).digest('hex'),
      sizeBytes: 8388608,
      expiresAt: new Date(Date.now() + ARTIFACT_TTL_MS).toISOString(),
    },
  }
}

export class MockExecutor implements Executor {
  private jobs = new Map<string, { spec: BuildSpec; polls: number }>()

  async submit(spec: BuildSpec): Promise<{ externalId: string }> {
    const externalId = `mock-${randomUUID()}`
    this.jobs.set(externalId, { spec, polls: 0 })
    return { externalId }
  }

  // Progression is purely poll-count driven: queued for the first 2 polls, building for the
  // next 3 (log lines appended progressively), then the terminal state on every later poll.
  async getStatus(externalId: string): Promise<ExecutorStatus> {
    const job = this.jobs.get(externalId)
    if (!job) throw new Error(`unknown mock build: ${externalId}`)
    job.polls += 1
    if (job.polls <= QUEUED_POLLS) return { state: 'queued' }
    const buildingPoll = job.polls - QUEUED_POLLS
    if (buildingPoll <= BUILDING_POLLS) {
      const lines = buildLogLines(job.spec)
      const visible = Math.ceil((lines.length * buildingPoll) / BUILDING_POLLS)
      return { state: 'building', logText: lines.slice(0, visible).join('\n') }
    }
    return finalStatus(externalId, job.spec)
  }

  async cancel(externalId: string): Promise<void> {
    this.jobs.delete(externalId)
  }
}

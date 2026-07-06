// GitHub Actions executor (V1, PRD §6): submits builds via workflow_dispatch on the public
// build repo, correlates runs through a client-generated build_id embedded in the run name,
// maps workflow-run states to ExecutorStatus, and reads artifact metadata from the
// conventional R2 path {R2_PUBLIC_BASE_URL}/builds/{build_id}/meta.json written by the
// workflow (.github/workflows/build-firmware.yml).
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { BuildArtifact, BuildSpec, Executor, ExecutorStatus } from './types'

const WORKFLOW_FILE = 'build-firmware.yml'
// Contract with the workflow's `run-name: Build ${{ inputs.build_id }}`.
const RUN_NAME_PREFIX = 'Build '

type WorkflowRun = {
  name: string
  display_title: string
  status: string
  conclusion: string | null
  html_url: string
}

// Shape of builds/{build_id}/meta.json as written by the workflow.
type ArtifactMeta = { file: string; sha256?: string; sizeBytes?: number; expiresAt?: string }

function env(key: 'BUILD_GITHUB_TOKEN' | 'BUILD_REPO' | 'R2_PUBLIC_BASE_URL'): string {
  const value = process.env[key]
  if (!value) throw new Error(`${key} is not set`)
  return value
}

function githubHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${env('BUILD_GITHUB_TOKEN')}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'openwrt-images-executor',
  }
}

async function readArtifact(buildId: string): Promise<BuildArtifact | undefined> {
  const base = env('R2_PUBLIC_BASE_URL')
  const res = await fetch(`${base}/builds/${buildId}/meta.json`)
  if (!res.ok) return undefined
  const meta = (await res.json()) as ArtifactMeta
  return {
    url: `${base}/builds/${buildId}/${meta.file}`,
    sha256: meta.sha256,
    sizeBytes: meta.sizeBytes,
    expiresAt: meta.expiresAt,
  }
}

export class GithubActionsExecutor implements Executor {
  async submit(spec: BuildSpec): Promise<{ externalId: string }> {
    // workflow_dispatch returns no run id, so a client-generated build_id is the correlation
    // key; the workflow writes it back into its run name.
    const buildId = randomUUID()
    const res = await fetch(
      `https://api.github.com/repos/${env('BUILD_REPO')}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        method: 'POST',
        headers: githubHeaders(),
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            build_id: buildId,
            distro: spec.distro,
            version: spec.version,
            target: spec.target,
            profile: spec.profileId,
            packages: spec.packages.join(' '),
            config_json: JSON.stringify(spec.config),
          },
        }),
      },
    )
    if (!res.ok) throw new Error(`workflow dispatch failed: ${res.status} ${await res.text()}`)
    return { externalId: buildId }
  }

  async getStatus(externalId: string): Promise<ExecutorStatus> {
    const res = await fetch(
      `https://api.github.com/repos/${env('BUILD_REPO')}/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=100`,
      { headers: githubHeaders() },
    )
    if (!res.ok) throw new Error(`listing workflow runs failed: ${res.status}`)
    const { workflow_runs: runs } = (await res.json()) as { workflow_runs: WorkflowRun[] }
    const runName = `${RUN_NAME_PREFIX}${externalId}`
    const run = runs.find((r) => r.display_title === runName || r.name === runName)
    // A dispatched run only appears in the API after a few seconds — treat as queued.
    if (!run) return { state: 'queued' }
    if (run.status !== 'completed') {
      return { state: run.status === 'in_progress' ? 'building' : 'queued', logUrl: run.html_url }
    }
    if (run.conclusion === 'success') {
      return { state: 'success', logUrl: run.html_url, artifact: await readArtifact(externalId) }
    }
    return { state: run.conclusion === 'timed_out' ? 'timeout' : 'failed', logUrl: run.html_url }
  }
}

export type WorkflowRunEvent = { buildId: string; conclusion: string | null }

/**
 * Verify a `workflow_run` webhook delivery (X-Hub-Signature-256: HMAC-SHA256 of the raw body,
 * keyed with BUILD_WEBHOOK_SECRET) and extract the correlation data. Pure function — the
 * webhook route (a later unit) supplies the raw body, header value, and secret.
 * Returns null for invalid signatures and for runs that are not firmware builds.
 */
export function parseWorkflowRunWebhook(
  payload: string,
  signature: string | null | undefined,
  secret: string,
): WorkflowRunEvent | null {
  if (!signature?.startsWith('sha256=')) return null
  const expected = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`
  const given = Buffer.from(signature)
  const wanted = Buffer.from(expected)
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null
  const event = JSON.parse(payload) as {
    workflow_run?: { display_title?: string; name?: string; conclusion?: string | null }
  }
  const title = event.workflow_run?.display_title ?? event.workflow_run?.name ?? ''
  if (!title.startsWith(RUN_NAME_PREFIX)) return null
  return { buildId: title.slice(RUN_NAME_PREFIX.length), conclusion: event.workflow_run?.conclusion ?? null }
}

// POST /api/webhooks/build — GitHub workflow_run callback (real mode only): verifies the
// X-Hub-Signature-256 HMAC and maps the run conclusion onto the matching build's status.
import { getDb } from '@/lib/db'
import type { BuildStatus } from '@/lib/db'
import { parseWorkflowRunWebhook } from '@/lib/executor'

const TERMINAL_STATUSES: BuildStatus[] = ['success', 'failed', 'timeout']

function mapConclusion(conclusion: string): BuildStatus {
  if (conclusion === 'success') return 'success'
  if (conclusion === 'timed_out') return 'timeout'
  return 'failed'
}

export async function POST(request: Request) {
  // The mock executor never posts webhooks — don't expose the endpoint outside real mode.
  if (process.env.APP_MODE !== 'real') return new Response(null, { status: 404 })
  const secret = process.env.BUILD_WEBHOOK_SECRET
  if (!secret) return new Response(null, { status: 503 })

  const payload = await request.text()
  const event = parseWorkflowRunWebhook(payload, request.headers.get('x-hub-signature-256'), secret)
  if (!event) return new Response(null, { status: 401 })

  // A null conclusion means the run is not finished yet (requested/in_progress) — nothing to record.
  if (event.conclusion) {
    const build = await getDb().builds.getByExternalId(event.buildId)
    // Never let a replayed delivery overwrite an already-terminal status.
    if (build && !TERMINAL_STATUSES.includes(build.status)) {
      await getDb().builds.updateStatus(build.id, { status: mapConclusion(event.conclusion) })
    }
  }
  return new Response(null, { status: 204 })
}

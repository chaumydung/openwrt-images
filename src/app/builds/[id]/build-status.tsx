'use client'

// Live build status: polls GET /api/builds/[id] every 3s (each poll advances the mock
// executor), renders the DESIGN.md progress layout — status badge + queue position,
// terminal-style log stream with auto-scroll, artifact download card / failure hint card.
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { trackEvent } from '@/lib/analytics'
import {
  POLL_INTERVAL_MS,
  artifactFilename,
  failureHintCopy,
  failureReason,
  formatExpiresAt,
  formatSizeBytes,
  queueLabel,
  shouldKeepPolling,
  statusBadge,
} from './lib'
import type { BuildView } from './lib'

type RequestError = { httpStatus: number; message: string; signInUrl?: string }

const cardClass = 'rounded-lg border border-slate-200 bg-white'
const primaryButtonClass =
  'inline-flex items-center gap-2 rounded-[6px] bg-sky-700 px-4 py-2 font-medium text-white hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700'
const secondaryButtonClass =
  'inline-flex items-center gap-2 rounded-[6px] border border-slate-300 bg-white px-4 py-2 font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700'

function StatusBadge({ status }: { status: BuildView['status'] }) {
  const badge = statusBadge(status)
  return (
    <span className={`inline-flex items-center gap-2 font-mono text-sm font-semibold ${badge.textClass}`}>
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${badge.dotClass}`} />
      {badge.label}
    </span>
  )
}

// Independent copy control (mirrors the device-page pattern without a cross-unit import).
function CopySha({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label="Copy sha256 checksum"
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
      className="inline-flex items-center gap-1 rounded-[6px] border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-700"
    >
      {copied ? (
        <>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3 text-green-700" aria-hidden="true">
            <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          copied
        </>
      ) : (
        <>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3" aria-hidden="true">
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
            <path d="M10.5 5.5v-2a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3.5v5A1.5 1.5 0 0 0 4 10h1.5" strokeLinecap="round" />
          </svg>
          copy
        </>
      )}
    </button>
  )
}

function LogStream({ view }: { view: BuildView }) {
  const boxRef = useRef<HTMLDivElement>(null)
  // Auto-scroll sticks to the bottom until the user scrolls up; scrolling back down re-arms it.
  const stickToBottom = useRef(true)

  useEffect(() => {
    const box = boxRef.current
    if (box && stickToBottom.current) box.scrollTop = box.scrollHeight
  }, [view.log])

  const placeholder =
    view.status === 'queued' ? 'Waiting for a build slot...' : view.status === 'building' ? 'Waiting for log output...' : 'No log output was captured for this build.'

  return (
    <section className="mt-6" aria-label="Build log">
      <div
        ref={boxRef}
        onScroll={() => {
          const box = boxRef.current
          if (box) stickToBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 16
        }}
        aria-live="polite"
        className="max-h-96 overflow-y-auto rounded-lg bg-slate-900 p-4"
      >
        <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-slate-200">
          {view.log ?? placeholder}
        </pre>
      </div>
      {!view.log && view.logUrl && (
        <a href={view.logUrl} target="_blank" rel="noopener noreferrer" className={`mt-3 ${secondaryButtonClass}`}>
          View full log on GitHub Actions
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M6.5 3.5H3.5A1 1 0 0 0 2.5 4.5v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9.5M9.5 2.5h4v4M13 3l-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      )}
    </section>
  )
}

function ArtifactCard({ view }: { view: BuildView }) {
  const artifact = view.artifact
  if (!artifact) return null
  const filename = artifactFilename(artifact.url)
  const expiresAt = artifact.expiresAt ?? view.artifactExpiresAt
  return (
    <section className={`mt-6 p-5 ${cardClass}`} aria-label="Firmware download">
      <h2 className="text-xl font-semibold text-slate-900">Your firmware is ready</h2>
      <p className="mt-2">
        <a href={artifact.url} className={`${primaryButtonClass} px-6 py-3 text-base`} download>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4" aria-hidden="true">
            <path d="M8 2v8m0 0 3.5-3.5M8 10 4.5 6.5M2.5 13.5h11" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download {filename}
        </a>
      </p>
      <dl className="mt-4 space-y-2 text-sm text-slate-600">
        {artifact.sha256 && (
          <div className="flex flex-wrap items-center gap-2">
            <dt className="font-semibold text-slate-900">sha256</dt>
            <dd className="flex min-w-0 items-center gap-2">
              <code className="break-all font-mono text-xs">{artifact.sha256}</code>
              <CopySha value={artifact.sha256} />
            </dd>
          </div>
        )}
        {artifact.sizeBytes !== undefined && (
          <div className="flex items-center gap-2">
            <dt className="font-semibold text-slate-900">Size</dt>
            <dd className="font-mono text-xs">{formatSizeBytes(artifact.sizeBytes)}</dd>
          </div>
        )}
      </dl>
      {expiresAt && (
        <p className="mt-4 rounded-[6px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Available for 7 days, until {formatExpiresAt(expiresAt)}. Download and keep a copy before it expires.
        </p>
      )}
      {artifact.sha256 && (
        <div className="mt-4">
          <p className="text-sm text-slate-600">Verify the download before flashing:</p>
          <pre className="mt-2 overflow-x-auto rounded-[6px] bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-200">
            {`$ sha256sum ${filename}\n${artifact.sha256}  ${filename}`}
          </pre>
        </div>
      )}
    </section>
  )
}

function FailureCard({ view }: { view: BuildView }) {
  const hint = failureHintCopy(view.failureHint)
  return (
    <section className={`mt-6 border-red-200 p-5 ${cardClass}`} aria-label="Build failure details">
      <h2 className="text-xl font-semibold text-red-700">
        {view.status === 'timeout' ? 'Build timed out' : 'Build failed'}
      </h2>
      {view.status === 'timeout' && (
        <p className="mt-2 text-sm text-slate-600">The build exceeded the 30 minute limit and was cancelled.</p>
      )}
      {hint && (
        <div className="mt-3 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-sm font-semibold text-red-700">{hint.title}</p>
          <p className="mt-1 text-sm text-slate-700">{hint.body}</p>
        </div>
      )}
      {!hint && view.status === 'failed' && (
        <p className="mt-2 text-sm text-slate-600">
          Something went wrong on our side while running this build. The full log below has the details.
        </p>
      )}
      {view.quotaRefunded ? (
        <p className="mt-3 text-sm text-green-700">Your daily quota has been refunded — you can start another build right away.</p>
      ) : (
        view.quotaResetAt && (
          <p className="mt-3 text-sm text-slate-600">
            Your daily build quota resets at <span className="font-mono">{formatExpiresAt(view.quotaResetAt)}</span>.
          </p>
        )
      )}
      <p className="mt-4">
        <Link href="/#builder" className={secondaryButtonClass}>
          Try again
        </Link>
      </p>
    </section>
  )
}

export function BuildStatus({ id }: { id: string }) {
  const [view, setView] = useState<BuildView | null>(null)
  const [error, setError] = useState<RequestError | null>(null)
  const doneRef = useRef(false) // terminal state or request error reached — never poll again
  const trackedRef = useRef(false)

  const track = useCallback((v: BuildView) => {
    if (trackedRef.current) return
    if (v.status === 'success') {
      trackedRef.current = true
      trackEvent({ event: 'build_succeeded' })
    } else if (v.status === 'failed' || v.status === 'timeout') {
      trackedRef.current = true
      trackEvent({ event: 'build_failed', reason: failureReason(v.status, v.failureHint) })
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined

    const schedule = () => {
      // Paused while the tab is hidden; the visibilitychange handler resumes polling.
      if (document.visibilityState === 'hidden') return
      timer = window.setTimeout(poll, POLL_INTERVAL_MS)
    }

    const poll = async () => {
      let body: unknown
      let ok = false
      let httpStatus = 0
      try {
        const res = await fetch(`/api/builds/${id}`, { cache: 'no-store' })
        httpStatus = res.status
        ok = res.ok
        body = await res.json()
      } catch {
        if (!cancelled) schedule() // transient network error — retry on the next tick
        return
      }
      if (cancelled) return
      if (!ok) {
        const { error: message, signInUrl } = body as { error?: string; signInUrl?: string }
        doneRef.current = true
        setError({ httpStatus, message: message ?? 'Something went wrong.', signInUrl })
        return
      }
      const next = body as BuildView
      setView(next)
      track(next)
      if (shouldKeepPolling(next.status)) schedule()
      else doneRef.current = true
    }

    const onVisibilityChange = () => {
      window.clearTimeout(timer)
      if (document.visibilityState === 'visible' && !doneRef.current) poll()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    poll()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [id, track])

  if (error) {
    if (error.httpStatus === 401) {
      return (
        <section className={`mt-6 p-5 ${cardClass}`}>
          <h2 className="text-xl font-semibold text-slate-900">Sign in to view this build</h2>
          <p className="mt-2 text-sm text-slate-600">{error.message}</p>
          <p className="mt-4">
            <a href={error.signInUrl ?? '/api/auth/signin'} className={primaryButtonClass}>
              Sign in with GitHub
            </a>
          </p>
        </section>
      )
    }
    return (
      <section className={`mt-6 p-5 ${cardClass}`}>
        <h2 className="text-xl font-semibold text-slate-900">
          {error.httpStatus === 404 ? 'Build not found' : 'Build unavailable'}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{error.message}</p>
        <p className="mt-4">
          <Link href="/" className={secondaryButtonClass}>
            Back to the homepage
          </Link>
        </p>
      </section>
    )
  }

  if (!view) {
    return (
      <p className="mt-6 animate-pulse font-mono text-sm text-slate-600" role="status">
        Loading build status...
      </p>
    )
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <StatusBadge status={view.status} />
        {view.status === 'queued' && view.queuePosition !== null && (
          <span className="font-mono text-sm text-slate-600">{queueLabel(view.queuePosition)}</span>
        )}
      </div>
      <LogStream view={view} />
      {view.status === 'success' && <ArtifactCard view={view} />}
      {(view.status === 'failed' || view.status === 'timeout') && <FailureCard view={view} />}
    </>
  )
}

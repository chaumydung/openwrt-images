'use client'
// Four-step firmware builder orchestrator: one useReducer holds cross-step state
// (distro, device, packages, config); the heavy package browser is code-split via
// next/dynamic; ?device={slug} prefills the device step; POST /api/builds on submit.
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useReducer, useRef, useState } from 'react'
import { trackEvent } from '@/lib/analytics'
import type { PackagePreset } from '@/lib/package-presets'
import ConfigStep from './config-step'
import { loadDeviceIndex } from './device-index'
import DeviceStep from './device-step'
import DistroStep from './distro-step'
import {
  buildRequestBody,
  canEnterStep,
  EMPTY_CONFIG,
  selectedBuild,
  STEP_LABELS,
  stepComplete,
  toggleId,
  validateConfig,
} from './lib'
import type {
  BuilderConfig,
  BuilderDevice,
  BuilderStep,
  CommunityComponentSummary,
  CuratedCategory,
  DistroId,
  DistroOption,
  SubmitError,
} from './lib'

const PackageStep = dynamic(() => import('./package-step'), {
  loading: () => (
    <p role="status" className="py-8 text-center text-sm text-slate-600">
      Loading the package browser…
    </p>
  ),
})

type State = {
  step: BuilderStep
  distro: DistroId
  device: BuilderDevice | null
  packages: string[]
  config: BuilderConfig
  communityPackages: string[]
  uiLanguage: string
}

type Action =
  | { type: 'go'; step: BuilderStep }
  | { type: 'set-distro'; distro: DistroId }
  | { type: 'select-device'; device: BuilderDevice }
  | { type: 'prefill-device'; device: BuilderDevice }
  | { type: 'set-packages'; packages: string[] }
  | { type: 'set-config'; field: keyof BuilderConfig; value: string }
  | { type: 'toggle-community'; id: string }
  | { type: 'set-language'; language: string }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'go':
      return { ...state, step: action.step }
    case 'set-distro':
      return { ...state, distro: action.distro }
    case 'select-device':
      return { ...state, device: action.device }
    case 'prefill-device': {
      if (state.device) return state // never clobber a device the user already picked
      const distro = selectedBuild(action.device, state.distro) ? state.distro : action.device.builds[0].distro
      return { ...state, device: action.device, distro, step: 3 }
    }
    case 'set-packages':
      return { ...state, packages: action.packages }
    case 'set-config':
      return { ...state, config: { ...state.config, [action.field]: action.value } }
    case 'toggle-community':
      return { ...state, communityPackages: toggleId(state.communityPackages, action.id) }
    case 'set-language':
      return { ...state, uiLanguage: action.language }
  }
}

const STEPS: BuilderStep[] = [1, 2, 3, 4]

export default function Builder({
  distros,
  presets,
  curated,
  community,
  languages,
}: {
  distros: DistroOption[]
  presets: PackagePreset[]
  curated: CuratedCategory[]
  community: CommunityComponentSummary[]
  languages: string[]
}) {
  const router = useRouter()
  const deviceParam = useSearchParams().get('device')
  const [state, dispatch] = useReducer(reducer, distros, (d) => ({
    step: 1 as BuilderStep,
    distro: d[0].id,
    device: null,
    packages: [],
    config: EMPTY_CONFIG,
    communityPackages: [],
    uiLanguage: 'en',
  }))
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<SubmitError | null>(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const focusPendingRef = useRef(false)
  const prefilledRef = useRef(false)

  // Prefill from /?device={slug}#builder (device page CTA): resolve the slug against the
  // device index, auto-complete steps 1-2 and land on the package step.
  useEffect(() => {
    if (!deviceParam || prefilledRef.current) return
    prefilledRef.current = true
    let cancelled = false
    loadDeviceIndex()
      .then((devices) => {
        if (cancelled) return
        const device = devices.find((d) => d.slug === deviceParam)
        if (device && device.builds.length > 0) dispatch({ type: 'prefill-device', device })
      })
      .catch(() => {
        // index unavailable — the user can still pick a device manually in step 2
      })
    return () => {
      cancelled = true
    }
  }, [deviceParam])

  // Move focus to the step heading on user-initiated step changes (not on load/prefill).
  useEffect(() => {
    if (focusPendingRef.current) {
      focusPendingRef.current = false
      headingRef.current?.focus()
    }
  }, [state.step])

  const sel = { distro: state.distro, device: state.device, config: state.config }
  const build = selectedBuild(state.device, state.distro)
  const distroOption = distros.find((d) => d.id === state.distro)

  function goToStep(step: BuilderStep) {
    if (step === state.step || !canEnterStep(step, sel)) return
    focusPendingRef.current = true
    dispatch({ type: 'go', step })
  }

  async function submit() {
    setSubmitAttempted(true)
    if (Object.keys(validateConfig(state.config)).length > 0) return
    const body = buildRequestBody(state)
    if (!body) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.status === 201) {
        trackEvent({ event: 'build_submitted', distro: body.distro, target: body.target, profile: body.profileId })
        router.push(`/builds/${data.id}`)
        return // keep the button disabled while navigating
      }
      if (res.status === 401) setSubmitError({ kind: 'signin', signInUrl: data.signInUrl ?? '/api/auth/signin' })
      else if (res.status === 429 && data.resetAt) setSubmitError({ kind: 'quota', resetAt: data.resetAt })
      else setSubmitError({ kind: 'message', text: typeof data?.error === 'string' ? data.error : 'Something went wrong — please try again.' })
    } catch {
      setSubmitError({ kind: 'message', text: 'Network error — please check your connection and try again.' })
    }
    setSubmitting(false)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* Step indicator */}
      <nav aria-label="Builder steps" className="border-b border-slate-200 px-4 py-3 sm:px-6">
        <ol className="flex flex-wrap gap-x-5 gap-y-2">
          {STEPS.map((s) => {
            const current = s === state.step
            const enabled = canEnterStep(s, sel)
            const done = s < state.step && stepComplete(s, sel)
            return (
              <li key={s}>
                <button
                  type="button"
                  disabled={!enabled}
                  aria-current={current ? 'step' : undefined}
                  onClick={() => goToStep(s)}
                  className={`inline-flex items-center gap-2 rounded-md text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-40 ${
                    current ? 'font-medium text-sky-700' : done ? 'text-slate-900 hover:text-sky-700' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full border font-mono text-xs ${
                      current
                        ? 'border-sky-600 bg-sky-600 text-white'
                        : done
                          ? 'border-green-700 bg-green-700 text-white'
                          : 'border-slate-300 text-slate-600'
                    }`}
                    aria-hidden="true"
                  >
                    {done ? (
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                        <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      s
                    )}
                  </span>
                  {STEP_LABELS[s]}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="px-4 py-5 sm:px-6">
        <p className="font-mono text-xs text-sky-700">Step {state.step} of 4</p>
        <h3 ref={headingRef} tabIndex={-1} className="mt-1 text-lg font-semibold text-slate-900 focus:outline-none">
          {STEP_LABELS[state.step]}
        </h3>

        <div className="mt-4">
          {state.step === 1 && (
            <DistroStep distros={distros} value={state.distro} onChange={(distro) => dispatch({ type: 'set-distro', distro })} />
          )}
          {state.step === 2 && (
            <DeviceStep
              distro={state.distro}
              distros={distros}
              device={state.device}
              onSelect={(device) => dispatch({ type: 'select-device', device })}
              onSwitchDistro={(distro) => dispatch({ type: 'set-distro', distro })}
            />
          )}
          {state.step === 3 && build && (
            <PackageStep
              key={`${build.distro}-${build.version}-${build.target}`}
              distro={build.distro}
              version={build.version}
              target={build.target}
              packages={state.packages}
              onChange={(packages) => dispatch({ type: 'set-packages', packages })}
              presets={presets}
              curated={curated}
              community={community}
              communityPackages={state.communityPackages}
              onToggleCommunity={(id) => dispatch({ type: 'toggle-community', id })}
              languages={languages}
              uiLanguage={state.uiLanguage}
              onLanguage={(language) => dispatch({ type: 'set-language', language })}
            />
          )}
          {state.step === 4 && build && state.device && (
            <ConfigStep
              config={state.config}
              onField={(field, value) => dispatch({ type: 'set-config', field, value })}
              showAllErrors={submitAttempted}
              summary={{
                deviceName: `${state.device.vendor} ${state.device.model}${state.device.variant ? ` ${state.device.variant}` : ''}`,
                distroLabel: distroOption?.label ?? state.distro,
                version: build.version,
                build,
                packageCount: state.packages.length,
                communityCount: state.communityPackages.length,
                uiLanguage: state.uiLanguage,
              }}
              submitting={submitting}
              submitError={submitError}
              onBuild={submit}
            />
          )}
        </div>

        {/* Step navigation */}
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
          {state.step > 1 ? (
            <button
              type="button"
              onClick={() => goToStep((state.step - 1) as BuilderStep)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
            >
              Back
            </button>
          ) : (
            <span />
          )}
          {state.step < 4 && (
            <button
              type="button"
              disabled={!stepComplete(state.step, sel)}
              onClick={() => goToStep((state.step + 1) as BuilderStep)}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-40"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

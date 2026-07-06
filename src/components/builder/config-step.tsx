'use client'
// Builder step 4 — whitelist config form (six optional fields, client-side prevalidation
// matching the API rules), build summary card, primary Build CTA, and submit feedback
// (sign-in wall, quota card with reset countdown, inline errors).
import { useState } from 'react'
import { AuthButton } from '@/components/auth-button'
import { relativeUntil, validateConfigField } from './lib'
import type { BuilderConfig, DeviceBuildRef, SubmitError } from './lib'

const FIELDS: { field: keyof BuilderConfig; label: string; placeholder: string; secret?: boolean }[] = [
  { field: 'hostname', label: 'Hostname', placeholder: 'OpenWrt' },
  { field: 'timezone', label: 'Time zone', placeholder: 'Europe/Berlin' },
  { field: 'lanIp', label: 'LAN IP address', placeholder: '192.168.1.1' },
  { field: 'rootPassword', label: 'Root password', placeholder: 'Empty = set on first login', secret: true },
  { field: 'wifiSsid', label: 'Wi-Fi SSID', placeholder: 'MyHomeWiFi' },
  { field: 'wifiPassword', label: 'Wi-Fi password', placeholder: '8+ characters for WPA2', secret: true },
]

type Props = {
  config: BuilderConfig
  onField: (field: keyof BuilderConfig, value: string) => void
  showAllErrors: boolean
  summary: { deviceName: string; distroLabel: string; version: string; build: DeviceBuildRef; packageCount: number }
  submitting: boolean
  submitError: SubmitError | null
  onBuild: () => void
}

export default function ConfigStep({ config, onField, showAllErrors, summary, submitting, submitError, onBuild }: Props) {
  const [touched, setTouched] = useState<Partial<Record<keyof BuilderConfig, boolean>>>({})
  const [revealed, setRevealed] = useState<Partial<Record<keyof BuilderConfig, boolean>>>({})

  return (
    <div>
      <p className="text-sm leading-relaxed text-slate-600">
        All fields are optional and get baked into the image. Build inputs and logs are publicly visible — avoid
        passwords you use elsewhere; everything can be changed after the first boot.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {FIELDS.map(({ field, label, placeholder, secret }) => {
          const error = validateConfigField(field, config[field])
          const showError = Boolean(error) && (Boolean(touched[field]) || showAllErrors)
          const errorId = `builder-config-${field}-error`
          const show = Boolean(revealed[field])
          return (
            <div key={field}>
              <label htmlFor={`builder-config-${field}`} className="text-sm font-medium text-slate-900">
                {label}
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id={`builder-config-${field}`}
                  type={secret && !show ? 'password' : 'text'}
                  autoComplete={secret ? 'new-password' : 'off'}
                  value={config[field]}
                  onChange={(e) => onField(field, e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, [field]: true }))}
                  placeholder={placeholder}
                  aria-invalid={showError ? true : undefined}
                  aria-describedby={showError ? errorId : undefined}
                  className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-700 ${
                    showError ? 'border-red-700' : 'border-slate-300 focus:border-sky-700'
                  }`}
                />
                {secret && (
                  <button
                    type="button"
                    aria-pressed={show}
                    onClick={() => setRevealed((r) => ({ ...r, [field]: !show }))}
                    className="shrink-0 rounded-[6px] border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {show ? 'Hide' : 'Show'}
                  </button>
                )}
              </div>
              {showError && (
                <p id={errorId} className="mt-1 text-xs text-red-700">
                  {error}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h4 className="text-sm font-semibold text-slate-900">Build summary</h4>
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="shrink-0 text-slate-600">Device</dt>
            <dd className="text-slate-900">{summary.deviceName}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-slate-600">Distribution</dt>
            <dd className="text-slate-900">
              {summary.distroLabel} <span className="font-mono text-xs">{summary.version}</span>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-slate-600">Profile</dt>
            <dd className="font-mono text-xs text-slate-900">
              {summary.build.target} / {summary.build.profileId}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-slate-600">Packages</dt>
            <dd className="text-slate-900">{summary.packageCount} selected</dd>
          </div>
        </dl>
      </div>

      <button
        type="button"
        onClick={onBuild}
        disabled={submitting}
        className="mt-5 inline-flex items-center gap-2 rounded-[6px] bg-sky-700 px-6 py-2.5 text-base font-medium text-white hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-40"
      >
        {submitting ? 'Submitting…' : 'Build firmware'}
      </button>

      {submitError?.kind === 'signin' && (
        <div role="alert" className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Sign in to build custom firmware</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Custom builds need a free account — registered users get 1 free custom build per day. Browsing devices and
            packages never requires signing in.
          </p>
          <div className="mt-3">
            <AuthButton user={null} />
          </div>
        </div>
      )}
      {submitError?.kind === 'quota' && (
        <div role="alert" className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Daily build limit reached</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Free accounts get 1 custom build per day. Your quota resets{' '}
            <span className="font-mono">{relativeUntil(submitError.resetAt)}</span> (
            {new Date(submitError.resetAt).toLocaleString()}).
          </p>
        </div>
      )}
      {submitError?.kind === 'message' && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {submitError.text}
        </p>
      )}
    </div>
  )
}

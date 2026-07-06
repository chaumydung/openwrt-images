'use client'
// Builder step 2 — device picker: ARIA combobox over the lazily fetched compact device
// index (client-side search, no per-keystroke network), selection summary with
// target/profile, and a switch hint when the chosen distro has no build for the device.
import { useEffect, useState } from 'react'
import { searchDevices } from '@/lib/search'
import { loadDeviceIndex } from './device-index'
import { DISTRO_LABELS, selectedBuild } from './lib'
import type { BuilderDevice, DistroId, DistroOption } from './lib'

type Props = {
  distro: DistroId
  distros: DistroOption[]
  device: BuilderDevice | null
  onSelect: (device: BuilderDevice) => void
  onSwitchDistro: (distro: DistroId) => void
}

// Fetch outcome keyed by retry attempt: stale results are ignored at read time,
// so the effect never needs a synchronous setState reset.
type IndexResult = { attempt: number; index?: BuilderDevice[]; error?: boolean }

export default function DeviceStep({ distro, distros, device, onSelect, onSwitchDistro }: Props) {
  const [result, setResult] = useState<IndexResult | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  useEffect(() => {
    loadDeviceIndex().then(
      (devices) => setResult({ attempt, index: devices }),
      () => setResult({ attempt, error: true }),
    )
  }, [attempt])

  const current = result?.attempt === attempt ? result : null
  const index = current?.index ?? null
  const loadError = Boolean(current?.error)

  const results = index && query.trim() ? searchDevices(index, query, 12) : []

  function select(d: BuilderDevice) {
    onSelect(d)
    setQuery('')
    setOpen(false)
    setActive(-1)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false)
      setActive(-1)
      return
    }
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1))
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      select(results[active])
    }
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-red-700">Could not load the device catalog.</p>
        <button
          type="button"
          onClick={() => setAttempt((a) => a + 1)}
          className="mt-3 rounded-[6px] border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Retry
        </button>
      </div>
    )
  }

  const build = selectedBuild(device, distro)
  const availableDistros = device ? [...new Set(device.builds.map((b) => b.distro))] : []

  return (
    <div>
      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="builder-device-listbox"
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `builder-device-option-${active}` : undefined}
          aria-label="Search your device model"
          placeholder={index ? 'Search your device model, e.g. GL-MT3000, NanoPi R4S, Archer C7...' : 'Loading device catalog…'}
          disabled={!index}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(-1)
            setOpen(Boolean(e.target.value.trim()))
          }}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (query.trim()) setOpen(true)
          }}
          onBlur={() => setOpen(false)}
          className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700 disabled:opacity-40"
        />
        {open && (
          <div className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {results.length > 0 ? (
              <ul id="builder-device-listbox" role="listbox" aria-label="Matching devices">
                {results.map((r, i) => (
                  <li
                    key={r.slug}
                    id={`builder-device-option-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2 ${
                      i === active ? 'bg-sky-700/10' : 'hover:bg-slate-50'
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      select(r)
                    }}
                    onMouseEnter={() => setActive(i)}
                  >
                    <span className="text-sm text-slate-900">
                      {r.vendor} {r.model}
                      {r.variant ? ` ${r.variant}` : ''}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-slate-600">
                      {[...new Set(r.builds.map((b) => b.distro))].map((d) => DISTRO_LABELS[d] ?? d).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status" className="px-4 py-3 text-sm text-slate-600">
                No devices match &ldquo;{query.trim()}&rdquo;. Try the model number printed on the device label, e.g.
                &ldquo;GL-MT3000&rdquo; or &ldquo;Archer C7&rdquo;.
              </p>
            )}
          </div>
        )}
      </div>

      {device && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">
            {device.vendor} {device.model}
            {device.variant ? ` ${device.variant}` : ''}
          </p>
          {build ? (
            <p className="mt-1 font-mono text-xs text-slate-600">
              target {build.target} · profile {build.profileId}
            </p>
          ) : (
            <div className="mt-2">
              <p className="text-sm text-amber-700">
                This device has no {DISTRO_LABELS[distro] ?? distro} build. It is available on{' '}
                {availableDistros.map((d) => DISTRO_LABELS[d] ?? d).join(' and ')} — switch the distribution or pick
                another device.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {availableDistros.map((d) => {
                  const option = distros.find((o) => o.id === d)
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onSwitchDistro(d)}
                      className="rounded-[6px] border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Switch to {DISTRO_LABELS[d] ?? d}
                      {option ? ` ${option.version}` : ''}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

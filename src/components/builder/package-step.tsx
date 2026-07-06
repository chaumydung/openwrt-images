'use client'
// Builder step 3 — package browser (code-split, loaded on demand): preset chips, category
// accordion with lazy panels and capped row rendering, cross-category search filter, and
// the removable selected-token list with manual add / "-pkg" exclusion support.
import { useEffect, useMemo, useState } from 'react'
import type { PackagePreset } from '@/lib/package-presets'
import {
  addPackageToken,
  applyPreset,
  filterPackages,
  formatSize,
  isPresetApplied,
  isValidPackageToken,
  removePackageToken,
  removePreset,
} from './lib'
import type { DistroId, PackageCategoryInfo, PackageInfo } from './lib'

type Props = {
  distro: DistroId
  version: string
  target: string
  packages: string[]
  onChange: (packages: string[]) => void
  presets: PackagePreset[]
}

type Catalog = { arch: string; categories: PackageCategoryInfo[]; total: number }

const PAGE = 100

// Fetch outcome keyed by the request parameters: stale results are ignored at read
// time, so the effect never needs a synchronous setState reset.
type FetchResult = { key: string; catalog?: Catalog; error?: string }

export default function PackageStep({ distro, version, target, packages, onChange, presets }: Props) {
  const [result, setResult] = useState<FetchResult | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [searchLimit, setSearchLimit] = useState(PAGE)
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({})
  const [tokenInput, setTokenInput] = useState('')
  const [tokenError, setTokenError] = useState<string | null>(null)

  const key = `${distro}|${version}|${target}|${attempt}`
  useEffect(() => {
    const params = new URLSearchParams({ distro, version, target })
    fetch(`/api/packages?${params}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) setResult({ key, error: typeof data?.error === 'string' ? data.error : 'Could not load the package list.' })
        else setResult({ key, catalog: data as Catalog })
      })
      .catch(() => setResult({ key, error: 'Network error while loading the package list.' }))
  }, [distro, version, target, key])

  const current = result?.key === key ? result : null
  const catalog = current?.catalog ?? null
  const error = current?.error ?? null

  const selected = useMemo(() => new Set(packages), [packages])
  const filtered = useMemo(
    () => (catalog && query.trim() ? filterPackages(catalog.categories, query) : []),
    [catalog, query],
  )

  function toggle(name: string, checked: boolean) {
    onChange(checked ? addPackageToken(packages, name) : removePackageToken(packages, name))
  }

  function addToken() {
    const token = tokenInput.trim()
    if (!token) return
    if (!isValidPackageToken(token)) {
      setTokenError('Package names may only contain letters, digits, ".", "_", "+", "-" (optional leading "-" to exclude).')
      return
    }
    onChange(addPackageToken(packages, token))
    setTokenInput('')
    setTokenError(null)
  }

  if (error) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => setAttempt((a) => a + 1)}
          className="mt-3 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!catalog) {
    return (
      <div role="status" className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">
          Loading the package list for <span className="font-mono">{target}</span>…
        </p>
        <div className="mt-3 space-y-2" aria-hidden="true">
          <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Preset groups */}
      <p className="text-sm font-medium text-slate-900">Preset package groups</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {presets.map((preset) => {
          const applied = isPresetApplied(packages, preset.packages)
          const empty = preset.packages.length === 0
          return (
            <button
              key={preset.id}
              type="button"
              disabled={empty}
              aria-pressed={applied}
              title={preset.description}
              onClick={() => onChange(applied ? removePreset(packages, preset.packages) : applyPreset(packages, preset.packages))}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-40 ${
                applied
                  ? 'border-sky-600 bg-sky-600/10 text-sky-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      {/* Search + browse */}
      <div className="mt-5">
        <label htmlFor="builder-package-filter" className="text-sm font-medium text-slate-900">
          Search packages
        </label>
        <input
          id="builder-package-filter"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSearchLimit(PAGE)
          }}
          placeholder={`Filter ${catalog.total.toLocaleString('en-US')} packages, e.g. luci-app-sqm, wireguard...`}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700"
        />
        <p className="mt-1 font-mono text-xs text-slate-600">
          arch {catalog.arch} · {catalog.total.toLocaleString('en-US')} packages
        </p>
      </div>

      {query.trim() ? (
        <div className="mt-3">
          <p role="status" className="text-sm text-slate-600">
            {filtered.length.toLocaleString('en-US')} match{filtered.length === 1 ? '' : 'es'}
          </p>
          <ul className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {filtered.slice(0, searchLimit).map((pkg) => (
              <PackageRow key={pkg.name} pkg={pkg} checked={selected.has(pkg.name)} onToggle={toggle} />
            ))}
          </ul>
          {filtered.length > searchLimit && (
            <button
              type="button"
              onClick={() => setSearchLimit((n) => n + PAGE)}
              className="mt-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
            >
              Show {Math.min(PAGE, filtered.length - searchLimit)} more
            </button>
          )}
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {catalog.categories.map((category) => {
            const id = `builder-cat-${category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
            const isOpen = Boolean(openCategories[category.name])
            const visible = visibleCounts[category.name] ?? PAGE
            const selectedCount = category.packages.reduce((n, p) => (selected.has(p.name) ? n + 1 : n), 0)
            return (
              <li key={category.name}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`${id}-panel`}
                  id={`${id}-button`}
                  onClick={() => setOpenCategories((open) => ({ ...open, [category.name]: !isOpen }))}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                >
                  <svg
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    className={`h-3 w-3 shrink-0 stroke-slate-600 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    fill="none"
                    strokeWidth="1.5"
                  >
                    <path d="M6 4l4 4-4 4" />
                  </svg>
                  <span className="text-sm font-medium text-slate-900">{category.name}</span>
                  <span className="ml-auto font-mono text-xs text-slate-600">
                    {selectedCount > 0 ? `${selectedCount} selected · ` : ''}
                    {category.packages.length.toLocaleString('en-US')}
                  </span>
                </button>
                {isOpen && (
                  <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-button`} className="border-t border-slate-100 px-1 pb-2">
                    <ul className="divide-y divide-slate-100">
                      {category.packages.slice(0, visible).map((pkg) => (
                        <PackageRow key={pkg.name} pkg={pkg} checked={selected.has(pkg.name)} onToggle={toggle} />
                      ))}
                    </ul>
                    {category.packages.length > visible && (
                      <button
                        type="button"
                        onClick={() => setVisibleCounts((counts) => ({ ...counts, [category.name]: visible + PAGE }))}
                        className="ml-2 mt-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
                      >
                        Show {Math.min(PAGE, category.packages.length - visible)} more
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Selected tokens */}
      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-900" aria-live="polite">
          {packages.length} package{packages.length === 1 ? '' : 's'} selected
        </p>
        {packages.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {packages.map((token) => (
              <li
                key={token}
                className={`inline-flex items-center gap-1 rounded-md border bg-white py-0.5 pl-2 pr-1 font-mono text-xs ${
                  token.startsWith('-') ? 'border-red-700/40 text-red-700' : 'border-slate-200 text-slate-700'
                }`}
              >
                {token}
                <button
                  type="button"
                  aria-label={`Remove ${token}`}
                  onClick={() => onChange(removePackageToken(packages, token))}
                  className="rounded px-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={tokenInput}
            onChange={(e) => {
              setTokenInput(e.target.value)
              setTokenError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addToken()
              }
            }}
            aria-label="Add a package by name"
            aria-invalid={tokenError ? true : undefined}
            aria-describedby={tokenError ? 'builder-token-error' : 'builder-token-hint'}
            placeholder="Add by name, e.g. htop"
            className="w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700"
          />
          <button
            type="button"
            onClick={addToken}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
          >
            Add
          </button>
        </div>
        {tokenError ? (
          <p id="builder-token-error" className="mt-1 text-xs text-red-700">
            {tokenError}
          </p>
        ) : (
          <p id="builder-token-hint" className="mt-1 text-xs text-slate-600">
            Prefix a name with <span className="font-mono">-</span> to exclude a default package, e.g.{' '}
            <span className="font-mono">-ppp</span>.
          </p>
        )}
      </div>
    </div>
  )
}

function PackageRow({
  pkg,
  checked,
  onToggle,
}: {
  pkg: PackageInfo
  checked: boolean
  onToggle: (name: string, checked: boolean) => void
}) {
  const size = formatSize(pkg.sizeBytes)
  return (
    <li>
      <label className="flex cursor-pointer items-start gap-3 px-3 py-1.5 hover:bg-slate-50">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(pkg.name, e.target.checked)}
          className="mt-1 accent-sky-700"
        />
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-sm text-slate-900">{pkg.name}</span>
            <span className="font-mono text-xs text-slate-600">
              {pkg.version}
              {size ? ` · ${size}` : ''}
            </span>
          </span>
          {pkg.description && <span className="block truncate text-xs text-slate-600">{pkg.description}</span>}
        </span>
      </label>
    </li>
  )
}

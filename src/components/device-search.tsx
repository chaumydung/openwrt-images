'use client'
// Homepage device search: accessible combobox (ARIA listbox pattern) with debounced /api/search autocomplete.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type SearchResult = {
  slug: string
  vendor: string
  model: string
  variant: string | null
  distros: string[]
}

const DISTRO_LABELS: Record<string, string> = { openwrt: 'OpenWrt', immortalwrt: 'ImmortalWrt' }

export default function DeviceSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  useEffect(() => {
    const q = query.trim()
    if (!q) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        if (!res.ok) return
        const data: SearchResult[] = await res.json()
        setResults(data)
        setActive(-1)
        setOpen(true)
      } catch {
        // fetch aborted by a newer keystroke — ignore
      }
    }, 150)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query])

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    if (!e.target.value.trim()) {
      setResults([])
      setOpen(false)
      setActive(-1)
    }
  }

  function select(slug: string) {
    setOpen(false)
    router.push(`/device/${slug}`)
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
      select(results[active].slug)
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="device-search-listbox"
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `device-search-option-${active}` : undefined}
        aria-label="Search your device model"
        placeholder="Search your device model, e.g. GL-MT3000, NanoPi R4S, Archer C7..."
        value={query}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (query.trim()) setOpen(true)
        }}
        onBlur={() => setOpen(false)}
        className="w-full rounded-md border border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
      />
      {open && (
        <div className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {results.length > 0 ? (
            <ul id="device-search-listbox" role="listbox" aria-label="Matching devices">
              {results.map((r, i) => (
                <li
                  key={r.slug}
                  id={`device-search-option-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2 ${
                    i === active ? 'bg-sky-700/10' : 'hover:bg-slate-50'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    select(r.slug)
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  <span className="text-sm text-slate-900">
                    {r.vendor} {r.model}
                    {r.variant ? ` ${r.variant}` : ''}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-slate-600">
                    {r.distros.map((d) => DISTRO_LABELS[d] ?? d).join(' · ')}
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
  )
}

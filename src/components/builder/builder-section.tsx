// Server wrapper for the homepage builder section: reads catalog meta and package presets
// at build time, keeps the three-step intro copy server-rendered, and mounts the client
// four-step builder under a Suspense boundary (required by its useSearchParams prefill).
import { Suspense } from 'react'
import { HOW_IT_WORKS } from '@/app/home-content'
import { getCatalog } from '@/lib/catalog'
import { getPackagePresets } from '@/lib/package-presets'
import Builder from './builder'
import { DISTRO_LABELS } from './lib'
import type { DistroId, DistroOption } from './lib'

export default function BuilderSection() {
  const distros: DistroOption[] = getCatalog().meta.distros.map((d) => ({
    id: d.id as DistroId,
    label: DISTRO_LABELS[d.id] ?? d.id,
    version: d.version,
  }))
  const presets = getPackagePresets()

  return (
    <section id="builder" className="mt-14">
      <h2 className="text-2xl font-semibold text-slate-900">Build your custom firmware</h2>
      <ol className="mt-5 grid gap-4 sm:grid-cols-3">
        {HOW_IT_WORKS.map((step, i) => (
          <li key={step.title} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="font-mono text-xs text-sky-700">{String(i + 1).padStart(2, '0')}</p>
            <h3 className="mt-2 text-base font-semibold text-slate-900">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
          </li>
        ))}
      </ol>
      <Suspense fallback={<BuilderFallback />}>
        <Builder distros={distros} presets={presets} />
      </Suspense>
    </section>
  )
}

// Matches the builder card's frame so the pre-hydration swap causes no layout shift.
function BuilderFallback() {
  return (
    <div className="mt-6 min-h-[420px] rounded-lg border border-slate-200 bg-white" aria-hidden="true">
      <div className="border-b border-slate-200 px-4 py-3 sm:px-6">
        <div className="h-5 w-2/3 max-w-sm animate-pulse rounded bg-slate-100" />
      </div>
      <div className="space-y-3 px-4 py-5 sm:px-6">
        <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
        <div className="h-6 w-44 animate-pulse rounded bg-slate-100" />
        <div className="h-28 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  )
}

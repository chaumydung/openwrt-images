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
    <>
      {/* How it works: white band, three columns with oversized mono step numbers */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <p className="font-mono text-xs uppercase tracking-widest text-sky-700">01 — How it works</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Build your custom firmware
          </h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-slate-200">
            {HOW_IT_WORKS.map((step, i) => (
              <li key={step.title} className="lg:px-8 lg:first:pl-0 lg:last:pr-0">
                <p aria-hidden="true" className="font-mono text-3xl font-semibold text-sky-600">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-3 text-base font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm/6 text-slate-600">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Builder card: slate-50 band (id="builder" is the device page CTA anchor) */}
      <section id="builder" className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6">
          <Suspense fallback={<BuilderFallback />}>
            <Builder distros={distros} presets={presets} />
          </Suspense>
        </div>
      </section>
    </>
  )
}

// Matches the builder card's frame so the pre-hydration swap causes no layout shift.
function BuilderFallback() {
  return (
    <div className="min-h-[420px] rounded-xl border border-slate-200 bg-white" aria-hidden="true">
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

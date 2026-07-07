import Link from 'next/link'
import BuilderSection from '@/components/builder/builder-section'
import DeviceSearch from '@/components/device-search'
import { HeroTerminal } from '@/components/terminal-window'
import { getCatalog } from '@/lib/catalog'
import { CATEGORY_LABELS, groupByCategory } from '@/lib/device-category'
import { getFeaturedSlugs, siteUrl } from '@/lib/seo'
import { buildHomeJsonLd, FAQ, FAQ_HEADING, HERO_SUBTITLE, HERO_TITLE, SECTIONS } from './home-content'

const DISTRO_LABELS: Record<string, string> = { openwrt: 'OpenWrt', immortalwrt: 'ImmortalWrt' }

// Mono kickers above each section h2 (docs/DESIGN.md v2). Decorative labels only —
// the SEO copy itself lives untouched in home-content.ts.
const kickerClass = 'font-mono text-xs uppercase tracking-widest text-sky-700'
const h2Class = 'mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl'
const COPY_KICKERS = ['Overview', 'Guide', 'Why this builder', 'ImmortalWrt']

/** Landing copy grouped into visual bands: a band starts at each h2 (h3 sections stay with their h2). */
function copyBands() {
  const bands: (typeof SECTIONS)[] = []
  for (const section of SECTIONS) {
    if (section.level === 2 || bands.length === 0) bands.push([])
    bands[bands.length - 1].push(section)
  }
  return bands
}

export default function Home() {
  const { devices, meta } = getCatalog()
  const bySlug = new Map(devices.map((d) => [d.slug, d]))
  const featured = getFeaturedSlugs()
    .slice(0, 24)
    .flatMap((slug) => {
      const device = bySlug.get(slug)
      return device ? [device] : []
    })
  const featuredGroups = groupByCategory(featured)
  const jsonLd = buildHomeJsonLd(siteUrl())

  return (
    <main className="flex-1">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero: dark band, H1 + search on the left, pure-CSS terminal window on the right */}
      <section className="bg-ink">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">{HERO_TITLE}</h1>
            <p className="mt-4 max-w-xl text-base/7 text-slate-400">{HERO_SUBTITLE}</p>
            <div className="mt-6">
              <DeviceSearch />
            </div>
            <p className="mt-5 flex flex-wrap gap-2">
              {meta.distros.map((d) => (
                <span
                  key={d.id}
                  className="rounded-full border border-white/15 px-2.5 py-0.5 font-mono text-xs text-slate-400"
                >
                  {DISTRO_LABELS[d.id] ?? d.id} {d.version}
                </span>
              ))}
              <span className="rounded-full border border-white/15 px-2.5 py-0.5 font-mono text-xs text-slate-400">
                {devices.length.toLocaleString('en-US')} devices
              </span>
            </p>
          </div>
          <HeroTerminal />
        </div>
      </section>

      {/* How it works (white) + four-step builder (slate-50, id="builder" CTA anchor) */}
      <BuilderSection />

      {/* Featured device internal links (SEO wave 1), grouped by hardware category */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <p className={kickerClass}>02 — Featured devices</p>
          <h2 className={h2Class}>Featured devices</h2>
          <p className="mt-3 max-w-3xl text-base/7 text-slate-600">
            Popular routers and boards with official firmware downloads and full custom-build support.
          </p>
          {featuredGroups.map((group) => (
            <div key={group.category} className="mt-8">
              <h3 className="text-sm font-semibold text-slate-900">{CATEGORY_LABELS[group.category]}</h3>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.devices.map((d) => (
                  <li
                    key={d.slug}
                    className="relative flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-colors focus-within:border-sky-600 focus-within:ring-2 focus-within:ring-sky-600 hover:border-sky-600"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 font-mono text-base font-semibold uppercase text-slate-700"
                    >
                      {d.vendor.charAt(0)}
                    </span>
                    <Link
                      href={`/device/${d.slug}`}
                      className="min-w-0 flex-1 text-sm before:absolute before:inset-0 focus-visible:outline-none"
                    >
                      <span className="block truncate font-medium text-slate-900">
                        {d.vendor} {d.model}
                      </span>
                      <span className="block text-xs text-slate-500">OpenWrt firmware</span>
                    </Link>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {[...new Set(d.builds.map((b) => b.distro))].map((distro) => (
                        <span
                          key={distro}
                          className="rounded-full border border-slate-200 px-2.5 py-0.5 font-mono text-xs text-slate-600"
                        >
                          {DISTRO_LABELS[distro] ?? distro}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Landing copy (SSR, keyword-bearing): centered prose bands, alternating slate-50 / white */}
      {copyBands().map((band, bandIndex) => (
        <section key={band[0].heading} className={bandIndex % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
          <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
            {band.map((section) =>
              section.level === 2 ? (
                <div key={section.heading}>
                  <p className={kickerClass}>
                    {String(bandIndex + 3).padStart(2, '0')} — {COPY_KICKERS[bandIndex] ?? 'More'}
                  </p>
                  <h2 className={h2Class}>{section.heading}</h2>
                  {section.paragraphs.map((p) => (
                    <p key={p.slice(0, 32)} className="mt-4 text-base/7 text-slate-600">
                      {p}
                    </p>
                  ))}
                </div>
              ) : (
                <div key={section.heading} className="mt-10">
                  <h3 className="text-xl font-semibold text-slate-900">{section.heading}</h3>
                  {section.paragraphs.map((p) => (
                    <p key={p.slice(0, 32)} className="mt-4 text-base/7 text-slate-600">
                      {p}
                    </p>
                  ))}
                </div>
              ),
            )}
          </div>
        </section>
      ))}

      {/* FAQ (server-rendered, not collapsed; mirrored in the FAQPage JSON-LD above) */}
      <section className="bg-slate-50">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <p className={kickerClass}>07 — FAQ</p>
          <h2 className={h2Class}>{FAQ_HEADING}</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {FAQ.map((item) => (
              <div key={item.question} className="rounded-lg border border-slate-200 bg-white p-6">
                <h3 className="text-base font-semibold text-slate-900">{item.question}</h3>
                <p className="mt-2 text-sm/6 text-slate-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

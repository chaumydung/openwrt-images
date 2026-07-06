import Link from 'next/link'
import DeviceSearch from '@/components/device-search'
import { getCatalog } from '@/lib/catalog'
import { getFeaturedSlugs, siteUrl } from '@/lib/seo'
import { buildHomeJsonLd, FAQ, FAQ_HEADING, HERO_SUBTITLE, HERO_TITLE, HOW_IT_WORKS, SECTIONS } from './home-content'

const DISTRO_LABELS: Record<string, string> = { openwrt: 'OpenWrt', immortalwrt: 'ImmortalWrt' }

export default function Home() {
  const { devices, meta } = getCatalog()
  const bySlug = new Map(devices.map((d) => [d.slug, d]))
  const featured = getFeaturedSlugs()
    .slice(0, 24)
    .flatMap((slug) => {
      const device = bySlug.get(slug)
      return device ? [device] : []
    })
  const jsonLd = buildHomeJsonLd(siteUrl())

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-20 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero: H1 + search + real catalog badges */}
      <section className="pt-14 sm:pt-20">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{HERO_TITLE}</h1>
        <p className="mt-3 max-w-2xl text-base text-slate-600">{HERO_SUBTITLE}</p>
        <div className="mt-6">
          <DeviceSearch />
        </div>
        <p className="mt-4 flex flex-wrap gap-2">
          {meta.distros.map((d) => (
            <span
              key={d.id}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs text-slate-600"
            >
              {DISTRO_LABELS[d.id] ?? d.id} {d.version}
            </span>
          ))}
          <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs text-slate-600">
            {devices.length.toLocaleString('en-US')} devices
          </span>
        </p>
      </section>

      {/* builder-ui unit will replace the content of this section; keep id="builder" */}
      <section id="builder" className="mt-14">
        <h2 className="text-2xl font-semibold text-slate-900">How it works</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.title} className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="font-mono text-xs text-sky-700">Step {i + 1} of 3</p>
              <h3 className="mt-2 text-base font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured device internal links (SEO wave 1) */}
      <section className="mt-14">
        <h2 className="text-2xl font-semibold text-slate-900">Featured devices</h2>
        <p className="mt-2 text-sm text-slate-600">
          Popular routers and boards with daily prebuilt images and full custom-build support.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((d) => (
            <li key={d.slug}>
              <Link
                href={`/device/${d.slug}`}
                className="block h-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-sky-700 hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-sky-700"
              >
                {`${d.vendor} ${d.model} OpenWrt firmware`}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Landing copy (SSR, keyword-bearing) */}
      {SECTIONS.map((section) => (
        <section key={section.heading} className={section.level === 2 ? 'mt-14' : 'mt-8'}>
          {section.level === 2 ? (
            <h2 className="text-2xl font-semibold text-slate-900">{section.heading}</h2>
          ) : (
            <h3 className="text-xl font-semibold text-slate-900">{section.heading}</h3>
          )}
          {section.paragraphs.map((p) => (
            <p key={p.slice(0, 32)} className="mt-4 max-w-3xl leading-relaxed text-slate-600">
              {p}
            </p>
          ))}
        </section>
      ))}

      {/* FAQ (server-rendered, not collapsed; mirrored in the FAQPage JSON-LD above) */}
      <section className="mt-14">
        <h2 className="text-2xl font-semibold text-slate-900">{FAQ_HEADING}</h2>
        {FAQ.map((item) => (
          <div key={item.question} className="mt-6">
            <h3 className="text-base font-semibold text-slate-900">{item.question}</h3>
            <p className="mt-2 max-w-3xl leading-relaxed text-slate-600">{item.answer}</p>
          </div>
        ))}
      </section>
    </main>
  )
}

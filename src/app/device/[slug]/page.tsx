// /device/[slug]: SSG (featured devices) + on-demand ISR device pages (PRD 4.2, docs/SEO.md 2).
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCatalog, getDeviceSpecs, getTargetMeta } from '@/lib/catalog'
import type { CatalogBuild, CatalogDevice } from '@/lib/catalog'
import {
  descriptionDistros,
  deviceDescription,
  deviceName,
  deviceTitle,
  imageTypeHint,
  sameTargetDevices,
  sameVendorDevices,
  specRows,
  titleDistro,
  upstreamImageUrl,
  upstreamTargetUrl,
  withUnit,
} from '@/lib/device-page'
import { getFeaturedSlugs, siteUrl } from '@/lib/seo'
import { CopyButton } from './copy-button'
import { PrebuiltImagesSection } from './prebuilt-images'

export const revalidate = 86400 // daily, matching the pnpm sync cadence
export const dynamicParams = true // non-featured slugs render on demand via ISR

export function generateStaticParams() {
  return getFeaturedSlugs().map((slug) => ({ slug }))
}

function findDevice(slug: string): CatalogDevice | undefined {
  return getCatalog().devices.find((d) => d.slug === slug)
}

/** Primary build for TDH strings: prefer OpenWrt, else the first build. */
function primaryBuild(device: CatalogDevice): CatalogBuild {
  return device.builds.find((b) => b.distro === 'openwrt') ?? device.builds[0]
}

function distroLabel(distro: CatalogBuild['distro']): string {
  return distro === 'openwrt' ? 'OpenWrt' : 'ImmortalWrt'
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const device = findDevice(slug)
  if (!device) return {}
  const name = deviceName(device)
  const title = deviceTitle(name, titleDistro(device.builds))
  const build = primaryBuild(device)
  const description = deviceDescription(name, descriptionDistros(device.builds), build.target, build.version)
  const canonical = `${siteUrl()}/device/${slug}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'website' },
    twitter: { card: 'summary', title, description },
  }
}

const h2Class = 'text-xl font-semibold text-slate-900'
const cardClass = 'rounded-lg border border-slate-200 bg-white'
const thClass = 'px-3 py-2 text-left font-semibold text-slate-900'

function BuildLabel({ build }: { build: CatalogBuild }) {
  return (
    <>
      {distroLabel(build.distro)} {build.version} · <span className="font-mono">{build.target}</span>
    </>
  )
}

export default async function DevicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const device = findDevice(slug)
  if (!device) notFound()

  const { devices } = getCatalog()
  const name = deviceName(device)
  const distro = titleDistro(device.builds)
  const build = primaryBuild(device)
  const description = deviceDescription(name, descriptionDistros(device.builds), build.target, build.version)
  const canonical = `${siteUrl()}/device/${slug}`
  const modelName = [device.model, device.variant].filter(Boolean).join(' ')

  const specs = getDeviceSpecs(slug)
  const rows = specs ? specRows(specs) : []
  const vendorSiblings = sameVendorDevices(devices, device)
  const targetSiblings = sameTargetDevices(devices, device)

  const packageGroups = device.builds
    .map((b) => ({
      build: b,
      devicePackages: b.devicePackages ?? [],
      targetDefaults: getTargetMeta(b.distro, b.version, b.target)?.defaultPackages ?? [],
    }))
    .filter((g) => g.devicePackages.length > 0 || g.targetDefaults.length > 0)

  const allImages = device.builds.flatMap((b) => b.images)
  const hasSysupgrade = allImages.some((i) => i.type.includes('sysupgrade'))
  const hasFactory = allImages.some((i) => i.type.includes('factory'))
  const hasRamBoot = allImages.some((i) => i.type === 'kernel' || i.type.startsWith('initramfs'))
  const shaExample = device.builds.flatMap((b) => b.images.filter((i) => i.sha256))[0]
  const upstreamLinks = [...new Map(device.builds.map((b) => [upstreamTargetUrl(b), b])).entries()]

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl()}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: device.vendor,
        item: `${siteUrl()}/?q=${encodeURIComponent(device.vendor)}`,
      },
      { '@type': 'ListItem', position: 3, name: modelName, item: canonical },
    ],
  }
  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    brand: { '@type': 'Brand', name: device.vendor },
    category: 'Router',
    description,
    url: canonical,
  }

  return (
    <div className="flex-1 bg-slate-50 text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }} />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* 1. Breadcrumb */}
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
            <li>
              <Link href="/" className="hover:text-sky-700 hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href={`/?q=${encodeURIComponent(device.vendor)}`} className="hover:text-sky-700 hover:underline">
                {device.vendor}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-slate-900">
              {modelName}
            </li>
          </ol>
        </nav>

        {/* 2. H1 + key-spec summary */}
        <header className="mt-4">
          <h1 className="text-3xl font-bold tracking-tight">
            {name} {distro} Firmware
          </h1>
          {specs && (specs.cpu || specs.ramMb || specs.flashMb) && (
            <p className="mt-3 flex flex-wrap gap-2 text-xs">
              {specs.cpu && (
                <span className="rounded-[6px] border border-slate-200 bg-white px-2 py-1 font-mono">CPU {specs.cpu}</span>
              )}
              {specs.ramMb && (
                <span className="rounded-[6px] border border-slate-200 bg-white px-2 py-1 font-mono">
                  {withUnit(specs.ramMb, 'MB')} RAM
                </span>
              )}
              {specs.flashMb && (
                <span className="rounded-[6px] border border-slate-200 bg-white px-2 py-1 font-mono">
                  {withUnit(specs.flashMb, 'MB')} flash
                </span>
              )}
            </p>
          )}
          <p className="mt-4 text-sm leading-6 text-slate-600">
            The {name} is supported by {descriptionDistros(device.builds)} on the{' '}
            <span className="font-mono">{build.target}</span> target. {allImages.length}{' '}
            {allImages.length === 1 ? 'firmware image is' : 'firmware images are'} available from the official{' '}
            {device.builds.map((b) => `${distroLabel(b.distro)} ${b.version}`).join(' and ')} stable{' '}
            {device.builds.length === 1 ? 'release' : 'releases'} — download one below, or build a custom {distro} image
            for this device with your own package selection.
          </p>
        </header>

        {/* 3. Specifications (omitted entirely when no ToH specs exist for this device) */}
        {rows.length > 0 && (
          <section className="mt-10">
            <h2 className={h2Class}>Specifications</h2>
            <div className={`mt-3 overflow-x-auto ${cardClass}`}>
              <table className="w-full text-sm">
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label} className="border-t border-slate-200 first:border-t-0 hover:bg-slate-50">
                      <th scope="row" className="w-48 px-3 py-2 text-left font-medium text-slate-600">
                        {r.label}
                      </th>
                      <td className="px-3 py-2 font-mono text-xs">{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Hardware data from the OpenWrt Table of Hardware; verify against your unit before flashing.
            </p>
          </section>
        )}

        {/* 4. Supported firmware versions matrix */}
        <section className="mt-10">
          <h2 className={h2Class}>Supported firmware versions</h2>
          <div className={`mt-3 overflow-x-auto ${cardClass}`}>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className={thClass}>Distribution</th>
                  <th className={thClass}>Version</th>
                  <th className={thClass}>Target</th>
                  <th className={thClass}>Profile</th>
                </tr>
              </thead>
              <tbody>
                {device.builds.map((b) => (
                  <tr key={`${b.distro}-${b.version}-${b.target}`} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="px-3 py-2">{distroLabel(b.distro)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{b.version}</td>
                    <td className="px-3 py-2 font-mono text-xs">{b.target}</td>
                    <td className="px-3 py-2 font-mono text-xs">{b.profileId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 5. Download images */}
        <section className="mt-10">
          <h2 className={h2Class}>Download images</h2>
          {/* prebuilt-images slot (PRD 5): this site's prebuilt image variants (R2 metadata +
              date-prefixed names); renders nothing when the device has no prebuilt data. */}
          <PrebuiltImagesSection device={device} />
          {device.builds.map((b) => (
            <div key={`${b.distro}-${b.version}-${b.target}`} className="mt-4">
              <h3 className="text-sm font-semibold text-slate-900">
                <BuildLabel build={b} />
              </h3>
              <div className={`mt-2 overflow-x-auto ${cardClass}`}>
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className={thClass}>Image</th>
                      <th className={`${thClass} w-32`}>Type</th>
                      <th className={`${thClass} w-44`}>sha256</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.images.map((img) => {
                      const hint = imageTypeHint(img.type)
                      return (
                        <tr key={img.name} className="border-t border-slate-200 align-top hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <a
                              href={upstreamImageUrl(b, img.name)}
                              className="inline-flex items-start gap-1.5 font-mono text-xs break-all text-sky-700 hover:underline"
                            >
                              <svg
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                aria-hidden="true"
                              >
                                <path d="M8 2v8m0 0 3-3m-3 3L5 7M3 13h10" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              {img.name}
                            </a>
                            {hint && <p className="mt-1 text-xs text-slate-600">{hint}</p>}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{img.type}</td>
                          <td className="px-3 py-2">
                            {img.sha256 ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="font-mono text-[11px] text-slate-600" title={img.sha256}>
                                  {img.sha256.slice(0, 12)}…
                                </span>
                                <CopyButton value={img.sha256} label={`Copy sha256 checksum of ${img.name}`} />
                              </span>
                            ) : (
                              <span className="text-xs text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <p className="mt-3 text-xs text-slate-600">
            Downloads are served by the official {descriptionDistros(device.builds)} mirrors — unchanged upstream stable
            builds.
          </p>
        </section>

        {/* 6+7. Default packages & installation */}
        {(packageGroups.length > 0 || hasSysupgrade || hasFactory || hasRamBoot || shaExample) && (
          <section className="mt-10">
            <h2 className={h2Class}>Default packages &amp; installation</h2>

            {packageGroups.length > 0 && (
              <>
                <h3 className="mt-4 text-sm font-semibold text-slate-900">Default packages</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Every image for the {name} ships these packages by default. The customize option below lets you add or
                  remove packages before the image is assembled.
                </p>
                {packageGroups.map((g) => (
                  <div
                    key={`${g.build.distro}-${g.build.version}-${g.build.target}`}
                    className={`mt-3 ${cardClass} p-4`}
                  >
                    {packageGroups.length > 1 && (
                      <p className="text-xs font-semibold text-slate-900">
                        <BuildLabel build={g.build} />
                      </p>
                    )}
                    {g.devicePackages.length > 0 && (
                      <div className={packageGroups.length > 1 ? 'mt-3' : ''}>
                        <p className="text-xs font-medium text-slate-600">Device packages ({g.devicePackages.length})</p>
                        <p className="mt-1 font-mono text-xs leading-6 break-words text-slate-700">
                          {g.devicePackages.join(' ')}
                        </p>
                      </div>
                    )}
                    {g.targetDefaults.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-slate-600">
                          Target default packages ({g.targetDefaults.length})
                        </p>
                        <p className="mt-1 font-mono text-xs leading-6 break-words text-slate-700">
                          {g.targetDefaults.join(' ')}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            <h3 className="mt-6 text-sm font-semibold text-slate-900">Installation notes</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
              {hasFactory && (
                <li>
                  First install from stock firmware: flash the <span className="font-mono text-xs">factory</span> image
                  through the vendor firmware&apos;s upgrade page or recovery mode.
                </li>
              )}
              {hasSysupgrade && (
                <li>
                  Already running OpenWrt or ImmortalWrt: flash the{' '}
                  <span className="font-mono text-xs">sysupgrade</span> image from LuCI (System → Backup / Flash
                  Firmware) or with the <span className="font-mono text-xs">sysupgrade</span> command.
                </li>
              )}
              {hasRamBoot && (
                <li>
                  The kernel / initramfs image boots from RAM without writing to flash — useful for a first install or
                  for recovering from a failed flash.
                </li>
              )}
              {shaExample && (
                <li>
                  Verify your download against the published checksum before flashing:
                  <pre className="mt-2 overflow-x-auto rounded-[6px] bg-slate-900 p-3 font-mono text-xs leading-5 text-slate-200">
                    {`$ sha256sum ${shaExample.name}\n${shaExample.sha256}  ${shaExample.name}`}
                  </pre>
                </li>
              )}
            </ul>
          </section>
        )}

        {/* 8. CTA → builder with device prefilled */}
        <section className={`mt-10 ${cardClass} p-6`}>
          <h2 className={h2Class}>Build custom firmware</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Need more than the default image for the {name}? Pick your packages — LuCI apps, themes, VPN clients — set
            the basics, and get a ready-to-flash {distro} image assembled from official packages in minutes.
          </p>
          <Link
            href={`/?device=${slug}#builder`}
            className="mt-4 inline-block rounded-[6px] bg-sky-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
          >
            Customize firmware for this device
          </Link>
        </section>

        {/* 9. Sibling-device internal links */}
        {(vendorSiblings.length > 0 || targetSiblings.length > 0) && (
          <section className="mt-10">
            <h2 className={h2Class}>Related devices</h2>
            {vendorSiblings.length > 0 && (
              <>
                <h3 className="mt-4 text-sm font-semibold text-slate-900">More {device.vendor} devices</h3>
                <ul className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  {vendorSiblings.map((d) => (
                    <li key={d.slug}>
                      <Link href={`/device/${d.slug}`} className="text-sm text-sky-700 hover:underline">
                        {deviceName(d)} {titleDistro(d.builds)} firmware
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {targetSiblings.length > 0 && (
              <>
                <h3 className="mt-5 text-sm font-semibold text-slate-900">
                  More devices on <span className="font-mono">{build.target}</span>
                </h3>
                <ul className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  {targetSiblings.map((d) => (
                    <li key={d.slug}>
                      <Link href={`/device/${d.slug}`} className="text-sm text-sky-700 hover:underline">
                        {deviceName(d)} {titleDistro(d.builds)} firmware
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {/* 10. Upstream & source (GPL) */}
        <section className="mt-10 border-t border-slate-200 pt-6">
          <h2 className={h2Class}>Upstream &amp; source</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {upstreamLinks.map(([url, b]) => (
              <li key={url}>
                <a href={url} className="inline-flex items-center gap-1.5 text-sky-700 hover:underline">
                  downloads.{b.distro}.org — {b.target} {b.version}
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="h-3 w-3"
                    aria-hidden="true"
                  >
                    <path d="M6.5 3.5h6v6M12.5 3.5 7 9M12 9.5V12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </li>
            ))}
            <li>
              <a href="https://openwrt.org/toh/start" className="inline-flex items-center gap-1.5 text-sky-700 hover:underline">
                OpenWrt Table of Hardware
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-3 w-3"
                  aria-hidden="true"
                >
                  <path d="M6.5 3.5h6v6M12.5 3.5 7 9M12 9.5V12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </li>
          </ul>
          <p className="mt-3 text-xs leading-5 text-slate-600">
            Images are assembled from packages compiled and published by the upstream OpenWrt and ImmortalWrt projects.
            The complete corresponding source code is available from those projects under the GPL.
          </p>
        </section>
      </main>
    </div>
  )
}

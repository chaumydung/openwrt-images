// Pure helpers for /device/[slug] pages: TDH strings, image-variant guidance copy,
// upstream download URL construction, spec-table rows, and sibling-device queries.
import type { CatalogBuild, CatalogDevice, DeviceSpecs } from './catalog-types'

/** Display name: vendor + model + optional variant (e.g. "TP-Link Archer C7 v5"). */
export function deviceName(device: Pick<CatalogDevice, 'vendor' | 'model' | 'variant'>): string {
  return [device.vendor, device.model, device.variant].filter(Boolean).join(' ')
}

/** Distro word leading the title/H1: "ImmortalWrt" only when no OpenWrt build exists (docs/SEO.md 2). */
export function titleDistro(builds: Pick<CatalogBuild, 'distro'>[]): 'OpenWrt' | 'ImmortalWrt' {
  return builds.some((b) => b.distro === 'openwrt') ? 'OpenWrt' : 'ImmortalWrt'
}

/** Distro label for the meta description: single distro name, or "OpenWrt/ImmortalWrt" when both build. */
export function descriptionDistros(builds: Pick<CatalogBuild, 'distro'>[]): string {
  const labels = [
    ...(builds.some((b) => b.distro === 'openwrt') ? ['OpenWrt'] : []),
    ...(builds.some((b) => b.distro === 'immortalwrt') ? ['ImmortalWrt'] : []),
  ]
  return labels.join('/')
}

/** Page title per docs/SEO.md TDH template, degrading the suffix to stay within 60 characters. */
export function deviceTitle(name: string, distro: string): string {
  const full = `${name} ${distro} Firmware — Download & Custom Build`
  if (full.length <= 60) return full
  const short = `${name} ${distro} Firmware Download`
  if (short.length <= 60) return short
  return `${name} ${distro} Firmware`
}

/** Meta description per docs/SEO.md TDH template (target + stable version included). */
export function deviceDescription(name: string, distros: string, target: string, version: string): string {
  return `Download prebuilt ${distros} images for ${name} (${target}) or build custom firmware online with your packages. sha256 verified, ${version} stable.`
}

/** Guidance copy per image type (PRD 5 wording style); null for niche types that get no hint. */
export function imageTypeHint(type: string): string | null {
  if (type.includes('sysupgrade')) return 'Not sure? Pick this if upgrading from OpenWrt.'
  if (type.includes('factory')) return 'For first-time flash from stock firmware.'
  if (type === 'kernel' || type.startsWith('initramfs')) {
    return 'Minimal kernel image, useful for first install or recovery.'
  }
  if (type.includes('rootfs')) return 'Rootfs archive for Docker / LXC containers.'
  if (type.includes('combined-efi')) return 'Make sure your device supports EFI boot.'
  if (type.includes('combined')) return 'Full disk image. Not sure which one? Pick this.'
  if (type.includes('recovery')) return 'Recovery image for restoring a device that no longer boots.'
  if (type.includes('sdcard')) return 'Disk image to write onto an SD card.'
  return null
}

const DISTRO_HOSTS: Record<CatalogBuild['distro'], string> = {
  openwrt: 'https://downloads.openwrt.org',
  immortalwrt: 'https://downloads.immortalwrt.org',
}

/** Official upstream target directory for a build. */
export function upstreamTargetUrl(build: Pick<CatalogBuild, 'distro' | 'version' | 'target'>): string {
  return `${DISTRO_HOSTS[build.distro]}/releases/${build.version}/targets/${build.target}/`
}

/** Official upstream download URL for one image of a build. */
export function upstreamImageUrl(
  build: Pick<CatalogBuild, 'distro' | 'version' | 'target'>,
  imageName: string,
): string {
  return `${upstreamTargetUrl(build)}${imageName}`
}

function bySlug(a: CatalogDevice, b: CatalogDevice): number {
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0
}

/** Same-vendor siblings, excluding the device itself; deterministic slug order, capped at `limit`. */
export function sameVendorDevices(devices: CatalogDevice[], device: CatalogDevice, limit = 8): CatalogDevice[] {
  return devices
    .filter((d) => d.vendor === device.vendor && d.slug !== device.slug)
    .sort(bySlug)
    .slice(0, limit)
}

/** Devices sharing a build target, excluding the device itself and its vendor (covered by the vendor block). */
export function sameTargetDevices(devices: CatalogDevice[], device: CatalogDevice, limit = 8): CatalogDevice[] {
  const targets = new Set(device.builds.map((b) => b.target))
  return devices
    .filter(
      (d) =>
        d.slug !== device.slug &&
        d.vendor !== device.vendor &&
        d.builds.some((b) => targets.has(b.target)),
    )
    .sort(bySlug)
    .slice(0, limit)
}

/** Appends a unit only to numeric-looking values — ToH fields sometimes hold text (e.g. flashMb "microSDHC"). */
export function withUnit(value: string, unit: string): string {
  return /^\d/.test(value) ? `${value} ${unit}` : value
}

const SPEC_FIELDS: [keyof DeviceSpecs, string, string?][] = [
  ['cpu', 'CPU'],
  ['cpuCores', 'CPU cores'],
  ['cpuMhz', 'CPU frequency', 'MHz'],
  ['ramMb', 'RAM', 'MB'],
  ['flashMb', 'Flash', 'MB'],
  ['ethernet100mPorts', '100 Mbit Ethernet ports'],
  ['ethernet1gPorts', '1 Gbit Ethernet ports'],
  ['ethernet2_5gPorts', '2.5 Gbit Ethernet ports'],
  ['ethernet5gPorts', '5 Gbit Ethernet ports'],
  ['ethernet10gPorts', '10 Gbit Ethernet ports'],
  ['wlanHardware', 'WLAN hardware'],
  ['switch', 'Switch'],
]

/** Table rows for the Specifications section: only fields that carry a value (kb data-site-seo/HR-4). */
export function specRows(specs: DeviceSpecs): { label: string; value: string }[] {
  return SPEC_FIELDS.flatMap(([key, label, unit]) => {
    const value = specs[key]
    return value ? [{ label, value: unit ? withUnit(value, unit) : value }] : []
  })
}

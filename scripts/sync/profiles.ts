// Fetches per-target profiles.json and normalizes profiles into catalog devices.
import { fetchJson, HttpNotFoundError } from './http'
import type { DistroConfig } from './types'
import type { CatalogDevice } from '../../src/lib/catalog-types'

export type { CatalogDevice } from '../../src/lib/catalog-types'

export type RawProfilesJson = {
  version_number: string
  target: string // e.g. "x86/64"
  arch_packages: string
  default_packages: string[]
  profiles: Record<
    string,
    {
      titles: { vendor?: string; model?: string; variant?: string; title?: string }[]
      images: { name: string; type: string; sha256?: string }[]
      device_packages?: string[]
    }
  >
}

export function slugify(vendor: string, model: string, variant?: string | null): string {
  return [vendor, model, variant]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function fetchProfiles(distro: DistroConfig, version: string, target: string): Promise<RawProfilesJson | null> {
  try {
    return await fetchJson<RawProfilesJson>(`${distro.baseUrl}/releases/${version}/targets/${target}/profiles.json`)
  } catch (err) {
    if (err instanceof HttpNotFoundError) return null
    throw err
  }
}

export function normalizeProfiles(raw: RawProfilesJson, distro: DistroConfig, version: string): CatalogDevice[] {
  const devices: CatalogDevice[] = []
  for (const [profileId, profile] of Object.entries(raw.profiles)) {
    const title = profile.titles[0] ?? {}
    const vendor = title.vendor ?? ''
    const model = title.model ?? title.title ?? profileId
    const variant = title.variant ?? null
    devices.push({
      slug: slugify(vendor || 'generic', model, variant),
      vendor: vendor || 'Generic',
      model,
      variant,
      builds: [{ distro: distro.id, version, target: raw.target, profileId }],
    })
  }
  return devices
}

export function mergeDevices(batches: CatalogDevice[][]): CatalogDevice[] {
  const bySlug = new Map<string, CatalogDevice>()
  for (const batch of batches) {
    for (const device of batch) {
      const existing = bySlug.get(device.slug)
      if (existing) existing.builds.push(...device.builds)
      else bySlug.set(device.slug, { ...device, builds: [...device.builds] })
    }
  }
  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug))
}

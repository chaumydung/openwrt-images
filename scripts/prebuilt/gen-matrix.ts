// Prebuilt-matrix CLI: prints the GitHub Actions build matrix (device × distro) for
// .github/workflows/prebuilt.yml from data/prebuilt/config.json + data/catalog/devices.json.
import { readFileSync } from 'node:fs'
import type { CatalogDevice } from '../../src/lib/catalog-types'

export type PrebuiltConfig = {
  devices: 'featured' | string[]
  distros: { id: CatalogDevice['builds'][number]['distro']; defaultPackages: string[] }[]
  retentionRuns: number
}

export type MatrixEntry = {
  slug: string
  distro: string
  version: string
  target: string
  profile: string
  packages: string
}

/** One matrix entry per (device, distro) pair; combos without a build for that distro are skipped. */
export function genMatrix(config: PrebuiltConfig, devices: CatalogDevice[], featured: string[]): MatrixEntry[] {
  const slugs = config.devices === 'featured' ? featured : config.devices
  const bySlug = new Map(devices.map((d) => [d.slug, d]))
  const entries: MatrixEntry[] = []
  for (const slug of slugs) {
    const device = bySlug.get(slug)
    if (!device) {
      console.warn(`[prebuilt] slug not in catalog, skipping: ${slug}`)
      continue
    }
    for (const distro of config.distros) {
      const build = device.builds.find((b) => b.distro === distro.id)
      if (!build) continue
      entries.push({
        slug,
        distro: distro.id,
        version: build.version,
        target: build.target,
        profile: build.profileId,
        packages: distro.defaultPackages.join(' '),
      })
    }
  }
  return entries
}

function main() {
  const config = JSON.parse(readFileSync('data/prebuilt/config.json', 'utf8')) as PrebuiltConfig
  const devices = JSON.parse(readFileSync('data/catalog/devices.json', 'utf8')) as CatalogDevice[]
  const { featured } = JSON.parse(readFileSync('data/seo/featured-devices.json', 'utf8')) as { featured: string[] }
  // Single-line JSON in `include` form, ready for `strategy.matrix: ${{ fromJSON(...) }}`.
  console.log(JSON.stringify({ include: genMatrix(config, devices, featured) }))
}

if (process.argv[1]?.endsWith('gen-matrix.ts')) main()

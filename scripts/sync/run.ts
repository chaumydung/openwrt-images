// Sync CLI: builds the device catalog from official downloads sites and writes data/catalog/.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { discoverStableVersion as realDiscoverVersion } from './discover-version'
import { discoverTargets as realDiscoverTargets } from './discover-targets'
import { fetchProfiles as realFetchProfiles, mergeDevices, normalizeProfiles, type RawProfilesJson } from './profiles'
import { mapLimit } from './map-limit'
import type { DistroConfig } from './types'
import type { CatalogDevice, CatalogMeta } from '../../src/lib/catalog-types'

type Deps = {
  discoverStableVersion: (d: DistroConfig) => Promise<string>
  discoverTargets: (d: DistroConfig, v: string) => Promise<string[]>
  fetchProfiles: (d: DistroConfig, v: string, t: string) => Promise<RawProfilesJson | null>
}

export async function buildCatalog(distros: DistroConfig[], deps: Deps): Promise<{ devices: CatalogDevice[]; meta: CatalogMeta }> {
  const batches: CatalogDevice[][] = []
  const metaDistros: CatalogMeta['distros'] = []
  for (const distro of distros) {
    const version = await deps.discoverStableVersion(distro)
    const targets = await deps.discoverTargets(distro, version)
    const perTarget = await mapLimit(targets, 8, async (target) => {
      const raw = await deps.fetchProfiles(distro, version, target)
      return raw ? normalizeProfiles(raw, distro, version) : []
    })
    const distroDevices = mergeDevices(perTarget)
    batches.push(distroDevices)
    metaDistros.push({ id: distro.id, version, targetCount: targets.length, deviceCount: distroDevices.length })
    console.log(`[sync] ${distro.id} ${version}: ${targets.length} targets, ${distroDevices.length} devices`)
  }
  return { devices: mergeDevices(batches), meta: { generatedAt: new Date().toISOString(), distros: metaDistros } }
}

async function main() {
  const distros = JSON.parse(readFileSync('config/distros.json', 'utf8')) as DistroConfig[]
  const { devices, meta } = await buildCatalog(distros, {
    discoverStableVersion: realDiscoverVersion,
    discoverTargets: realDiscoverTargets,
    fetchProfiles: realFetchProfiles,
  })
  mkdirSync('data/catalog', { recursive: true })
  writeFileSync('data/catalog/devices.json', JSON.stringify(devices))
  writeFileSync('data/catalog/meta.json', JSON.stringify(meta, null, 2))
  console.log(`[sync] wrote ${devices.length} devices to data/catalog/`)
}

if (process.argv[1]?.endsWith('run.ts')) main()

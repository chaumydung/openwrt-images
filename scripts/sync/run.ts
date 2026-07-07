// Sync CLI: builds the device catalog from official downloads sites and writes data/catalog/.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { discoverStableVersion as realDiscoverVersion } from './discover-version'
import { discoverTargets as realDiscoverTargets } from './discover-targets'
import { fetchProfiles as realFetchProfiles, mergeDevices, normalizeProfiles, type RawProfilesJson } from './profiles'
import { fetchToh, buildSpecs } from './toh'
import { mapLimit } from './map-limit'
import { syncCommunity } from './community'
import { getCommunityComponents } from '../../src/lib/community-packages'
import type { DistroConfig } from './types'
import type { CatalogDevice, CatalogMeta, DeviceSpecs, TargetMeta } from '../../src/lib/catalog-types'

type Deps = {
  discoverStableVersion: (d: DistroConfig) => Promise<string>
  discoverTargets: (d: DistroConfig, v: string) => Promise<string[]>
  fetchProfiles: (d: DistroConfig, v: string, t: string) => Promise<RawProfilesJson | null>
}

export async function buildCatalog(
  distros: DistroConfig[],
  deps: Deps,
): Promise<{ devices: CatalogDevice[]; meta: CatalogMeta; targets: Record<string, TargetMeta> }> {
  const batches: CatalogDevice[][] = []
  const metaDistros: CatalogMeta['distros'] = []
  const targetMeta: Record<string, TargetMeta> = {}
  for (const distro of distros) {
    const version = await deps.discoverStableVersion(distro)
    const targets = await deps.discoverTargets(distro, version)
    const perTarget = await mapLimit(targets, 8, async (target) => {
      const raw = await deps.fetchProfiles(distro, version, target)
      if (!raw) return []
      targetMeta[`${distro.id}/${version}/${raw.target}`] = {
        defaultPackages: raw.default_packages,
        archPackages: raw.arch_packages,
      }
      return normalizeProfiles(raw, distro, version)
    })
    const distroDevices = mergeDevices(perTarget)
    batches.push(distroDevices)
    metaDistros.push({ id: distro.id, version, targetCount: targets.length, deviceCount: distroDevices.length })
    console.log(`[sync] ${distro.id} ${version}: ${targets.length} targets, ${distroDevices.length} devices`)
  }
  const sortedTargets = Object.fromEntries(Object.entries(targetMeta).sort(([a], [b]) => a.localeCompare(b)))
  return {
    devices: mergeDevices(batches),
    meta: { generatedAt: new Date().toISOString(), distros: metaDistros },
    targets: sortedTargets,
  }
}

async function main() {
  const distros = JSON.parse(readFileSync('config/distros.json', 'utf8')) as DistroConfig[]
  const { devices, meta, targets } = await buildCatalog(distros, {
    discoverStableVersion: realDiscoverVersion,
    discoverTargets: realDiscoverTargets,
    fetchProfiles: realFetchProfiles,
  })
  mkdirSync('data/catalog', { recursive: true })
  writeFileSync('data/catalog/devices.json', JSON.stringify(devices))
  writeFileSync('data/catalog/meta.json', JSON.stringify(meta, null, 2))
  writeFileSync('data/catalog/targets.json', JSON.stringify(targets))
  console.log(`[sync] wrote ${devices.length} devices, ${Object.keys(targets).length} targets to data/catalog/`)

  // ToH specs are best-effort: on failure keep the previous specs.json (or an empty object) and warn.
  let specs: Record<string, DeviceSpecs> = existsSync('data/catalog/specs.json')
    ? JSON.parse(readFileSync('data/catalog/specs.json', 'utf8'))
    : {}
  try {
    specs = buildSpecs(devices, await fetchToh())
    console.log(`[sync] matched ToH specs for ${Object.keys(specs).length} devices`)
  } catch (err) {
    console.warn(`[sync] ToH fetch failed, keeping previous specs.json: ${err}`)
  }
  writeFileSync('data/catalog/specs.json', JSON.stringify(specs))

  // Community add-on latest snapshots: fetch the latest release for github-release components.
  const community = await syncCommunity(getCommunityComponents(), fetch)
  mkdirSync('data/packages', { recursive: true })
  writeFileSync(
    path.join(process.cwd(), 'data/packages/community.json'),
    JSON.stringify({ languages: ['en', 'zh-cn', 'zh-tw', 'ru'], components: community }, null, 2) + '\n',
  )
  console.warn(`[sync] community: refreshed ${community.filter((c) => c.latest.version).length}/${community.length} latest snapshots`)
}

if (process.argv[1]?.endsWith('run.ts')) main()

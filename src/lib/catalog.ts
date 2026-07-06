import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { CatalogDevice, CatalogMeta, DeviceSpecs, TargetMeta } from './catalog-types'

export type { CatalogBuild, CatalogDevice, CatalogImage, CatalogMeta, DeviceSpecs, TargetMeta } from './catalog-types'
export { searchDevices } from './search'

function readCatalogFile<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(process.cwd(), 'data/catalog', file), 'utf8')) as T
}

let cache: { devices: CatalogDevice[]; meta: CatalogMeta } | null = null

export function getCatalog(): { devices: CatalogDevice[]; meta: CatalogMeta } {
  if (!cache) {
    cache = {
      devices: readCatalogFile('devices.json'),
      meta: readCatalogFile('meta.json'),
    }
  }
  return cache
}

let targetsCache: Record<string, TargetMeta> | null = null

export function getTargetMeta(distro: string, version: string, target: string): TargetMeta | null {
  const targets = (targetsCache ??= readCatalogFile<Record<string, TargetMeta>>('targets.json'))
  return targets[`${distro}/${version}/${target}`] ?? null
}

let specsCache: Record<string, DeviceSpecs> | null = null

export function getDeviceSpecs(slug: string): DeviceSpecs | null {
  const specs = (specsCache ??= readCatalogFile<Record<string, DeviceSpecs>>('specs.json'))
  return specs[slug] ?? null
}

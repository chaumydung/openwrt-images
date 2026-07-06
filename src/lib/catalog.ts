import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { CatalogDevice, CatalogMeta } from './catalog-types'

export type { CatalogDevice, CatalogMeta } from './catalog-types'
export { searchDevices } from './search'

let cache: { devices: CatalogDevice[]; meta: CatalogMeta } | null = null

export function getCatalog(): { devices: CatalogDevice[]; meta: CatalogMeta } {
  if (!cache) {
    const dir = path.join(process.cwd(), 'data/catalog')
    cache = {
      devices: JSON.parse(readFileSync(path.join(dir, 'devices.json'), 'utf8')),
      meta: JSON.parse(readFileSync(path.join(dir, 'meta.json'), 'utf8')),
    }
  }
  return cache
}

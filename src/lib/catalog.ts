import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { CatalogDevice, CatalogMeta } from './catalog-types'

export type { CatalogDevice, CatalogMeta } from './catalog-types'

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

export function searchDevices(devices: CatalogDevice[], query: string, limit = 20): CatalogDevice[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return devices.filter((d) => `${d.vendor} ${d.model} ${d.variant ?? ''}`.toLowerCase().includes(q)).slice(0, limit)
}

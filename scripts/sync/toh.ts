// Downloads the OpenWrt Table of Hardware (toh.json) and matches catalog devices to compact hardware specs.
import { fetchJson } from './http'
import type { CatalogDevice, DeviceSpecs } from '../../src/lib/catalog-types'

// toh.json is a column/row table: columns[i] names the value at entries[row][i].
export type TohJson = {
  columns: string[]
  entries: (string | string[] | null)[][]
}

const TOH_URL = 'https://openwrt.org/toh.json'

// ToH column id -> compact spec field.
const SPEC_COLUMNS: Record<string, keyof DeviceSpecs> = {
  cpu: 'cpu',
  cpucores: 'cpuCores',
  cpumhz: 'cpuMhz',
  rammb: 'ramMb',
  flashmb: 'flashMb',
  ethernet100mports: 'ethernet100mPorts',
  ethernet1gports: 'ethernet1gPorts',
  ethernet2_5gports: 'ethernet2_5gPorts',
  ethernet5gports: 'ethernet5gPorts',
  ethernet10gports: 'ethernet10gPorts',
  wlanhardware: 'wlanHardware',
  switch: 'switch',
}

export async function fetchToh(): Promise<TohJson> {
  // ~20MB download: generous per-attempt timeout, single retry; failures bubble up to the caller.
  return fetchJson<TohJson>(TOH_URL, { retries: 1, timeoutMs: 120_000 })
}

// ToH uses "-" and "¿" as unknown/empty markers; multi-value cells are arrays.
function cellText(cell: string | string[] | null | undefined): string {
  const parts = Array.isArray(cell) ? cell : [cell ?? '']
  return parts
    .map((p) => (p ?? '').trim())
    .filter((p) => p && p !== '-' && p !== '¿')
    .join(', ')
}

function norm(...parts: (string | null)[]): string {
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function extractSpecs(entry: TohJson['entries'][number], colIndex: Map<string, number>): DeviceSpecs | null {
  const specs: DeviceSpecs = {}
  for (const [column, field] of Object.entries(SPEC_COLUMNS)) {
    const idx = colIndex.get(column)
    if (idx === undefined) continue
    const value = cellText(entry[idx])
    if (value) specs[field] = value
  }
  return Object.keys(specs).length ? specs : null
}

// Best-effort matching by normalized brand+model(+version). Deliberately conservative: when one
// identity key maps to ToH rows with differing specs, it is ambiguous and never matched.
export function buildSpecs(
  devices: Pick<CatalogDevice, 'slug' | 'vendor' | 'model' | 'variant'>[],
  toh: TohJson,
): Record<string, DeviceSpecs> {
  const colIndex = new Map(toh.columns.map((c, i) => [c, i]))
  const brandIdx = colIndex.get('brand')
  const modelIdx = colIndex.get('model')
  const versionIdx = colIndex.get('version')
  if (brandIdx === undefined || modelIdx === undefined || versionIdx === undefined) {
    throw new Error('toh.json is missing brand/model/version columns')
  }

  const index = new Map<string, DeviceSpecs | 'ambiguous'>()
  const add = (key: string, specs: DeviceSpecs) => {
    const existing = index.get(key)
    if (existing === undefined) index.set(key, specs)
    else if (existing !== 'ambiguous' && JSON.stringify(existing) !== JSON.stringify(specs)) index.set(key, 'ambiguous')
  }
  for (const entry of toh.entries) {
    const brand = cellText(entry[brandIdx])
    const model = cellText(entry[modelIdx])
    if (!brand || !model) continue
    const specs = extractSpecs(entry, colIndex)
    if (!specs) continue
    add(norm(brand, model), specs)
    const version = cellText(entry[versionIdx])
    if (version) add(norm(brand, model, version), specs)
  }

  const out: Record<string, DeviceSpecs> = {}
  for (const device of devices) {
    // Variant devices try brand+model+variant first, then fall back to brand+model — the fallback
    // only succeeds when every ToH row for that model carries identical specs (ambiguity guard).
    const keys = device.variant
      ? [norm(device.vendor, device.model, device.variant), norm(device.vendor, device.model)]
      : [norm(device.vendor, device.model)]
    for (const key of keys) {
      const hit = index.get(key)
      if (hit === undefined) continue
      if (hit !== 'ambiguous') out[device.slug] = hit
      break
    }
  }
  return out
}

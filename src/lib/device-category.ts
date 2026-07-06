// Pure display helper for the homepage featured grid: coarse device category
// (x86 & virtualization / single-board computers / routers) derived from build targets.
import type { CatalogDevice } from './catalog-types'

export type DeviceCategory = 'x86' | 'sbc' | 'router'

export const CATEGORY_ORDER: DeviceCategory[] = ['x86', 'sbc', 'router']

export const CATEGORY_LABELS: Record<DeviceCategory, string> = {
  x86: 'x86 & virtualization',
  sbc: 'Single-board computers',
  router: 'Routers & access points',
}

const X86_TARGETS = new Set(['x86', 'armsr'])
const SBC_TARGETS = new Set(['bcm27xx', 'rockchip', 'sunxi', 'amlogic', 'sifiveu', 'd1'])

type Categorizable = Pick<CatalogDevice, 'builds'>

export function deviceCategory(device: Categorizable): DeviceCategory {
  const targets = device.builds.map((b) => b.target.split('/')[0])
  if (targets.some((t) => X86_TARGETS.has(t))) return 'x86'
  if (targets.some((t) => SBC_TARGETS.has(t))) return 'sbc'
  return 'router'
}

/** Groups devices by category in CATEGORY_ORDER, dropping empty groups and preserving input order. */
export function groupByCategory<T extends Categorizable>(devices: T[]): { category: DeviceCategory; devices: T[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    devices: devices.filter((d) => deviceCategory(d) === category),
  })).filter((g) => g.devices.length > 0)
}

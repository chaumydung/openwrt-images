// Shared catalog types: single definition consumed by both the sync scripts and the Next.js app.
export type CatalogImage = {
  name: string
  type: string
  sha256?: string
}

export type CatalogBuild = {
  distro: 'openwrt' | 'immortalwrt'
  version: string
  target: string
  profileId: string
  images: CatalogImage[]
  devicePackages?: string[]
}

export type CatalogDevice = {
  slug: string
  vendor: string
  model: string
  variant: string | null
  builds: CatalogBuild[]
}

export type CatalogMeta = {
  generatedAt: string
  distros: { id: string; version: string; targetCount: number; deviceCount: number }[]
}

// data/catalog/targets.json: keyed by `${distro}/${version}/${target}`.
export type TargetMeta = {
  defaultPackages: string[]
  archPackages: string
}

// data/catalog/specs.json: compact Table-of-Hardware specs keyed by device slug (matched devices only).
export type DeviceSpecs = {
  cpu?: string
  cpuCores?: string
  cpuMhz?: string
  ramMb?: string
  flashMb?: string
  ethernet100mPorts?: string
  ethernet1gPorts?: string
  ethernet2_5gPorts?: string
  ethernet5gPorts?: string
  ethernet10gPorts?: string
  wlanHardware?: string
  switch?: string
}

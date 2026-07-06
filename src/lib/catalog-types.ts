// Shared catalog types: single definition consumed by both the sync scripts and the Next.js app.
export type CatalogDevice = {
  slug: string
  vendor: string
  model: string
  variant: string | null
  builds: { distro: 'openwrt' | 'immortalwrt'; version: string; target: string; profileId: string }[]
}

export type CatalogMeta = {
  generatedAt: string
  distros: { id: string; version: string; targetCount: number; deviceCount: number }[]
}

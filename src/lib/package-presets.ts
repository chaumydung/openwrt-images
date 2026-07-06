// Typed reader for data/package-presets.json — curated neutral package groups shown in the builder.
import { readFileSync } from 'node:fs'
import path from 'node:path'

export type PackagePreset = {
  id: string
  label: string
  description: string
  packages: string[]
}

let cache: PackagePreset[] | null = null

export function getPackagePresets(): PackagePreset[] {
  if (!cache) {
    const raw = JSON.parse(readFileSync(path.join(process.cwd(), 'data/package-presets.json'), 'utf8')) as { presets: PackagePreset[] }
    cache = raw.presets
  }
  return cache
}

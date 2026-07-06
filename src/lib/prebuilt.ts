// Prebuilt-image consumption layer (PRD 5): the device page reads per-device variant metadata
// written by .github/workflows/prebuilt.yml — from R2 latest.json in real mode, or from local
// fixtures in data/prebuilt/fixtures/ in mock mode.
import { readFileSync } from 'node:fs'
import path from 'node:path'

export type PrebuiltVariant = {
  file: string
  type: string
  sha256: string
  sizeBytes: number
  hintKey: string
  url: string
}

export type PrebuiltImages = {
  version: string
  buildDate: string
  variants: PrebuiltVariant[]
}

// Shape of prebuilt/{slug}/{distro}/latest.json as written by the workflow (fixtures mirror it).
type LatestJson = {
  slug: string
  distro: string
  version: string
  buildDate: string
  variants: Omit<PrebuiltVariant, 'url'>[]
}

// Download links in mock mode point at an obviously fake host instead of real R2.
const MOCK_BASE_URL = 'https://prebuilt.mock.invalid'

function compose(base: string, slug: string, distro: string, meta: LatestJson): PrebuiltImages {
  return {
    version: meta.version,
    buildDate: meta.buildDate,
    variants: meta.variants.map((v) => ({
      ...v,
      url: `${base}/prebuilt/${slug}/${distro}/${meta.buildDate}/${v.file}`,
    })),
  }
}

/**
 * Prebuilt image variants for a device × distro, or null when none exist (non-featured device,
 * distro without a prebuilt run, or metadata not uploaded yet).
 */
export async function getPrebuiltImages(slug: string, distro: string): Promise<PrebuiltImages | null> {
  const base = process.env.R2_PUBLIC_BASE_URL
  if (process.env.APP_MODE !== 'real' || !base) {
    let raw: string
    try {
      raw = readFileSync(path.join(process.cwd(), 'data/prebuilt/fixtures', `${slug}.json`), 'utf8')
    } catch {
      return null
    }
    const meta = JSON.parse(raw) as LatestJson
    if (meta.distro !== distro) return null
    return compose(base ?? MOCK_BASE_URL, slug, distro, meta)
  }
  const res = await fetch(`${base}/prebuilt/${slug}/${distro}/latest.json`, { next: { revalidate: 3600 } })
  if (!res.ok) return null
  const meta = (await res.json()) as LatestJson
  return compose(base, slug, distro, meta)
}

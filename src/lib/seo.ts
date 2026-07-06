// SEO config readers: canonical site URL plus the featured-device and sitemap-wave lists in data/seo/.
import { readFileSync } from 'node:fs'
import path from 'node:path'

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

function readJson<T>(relPath: string): T {
  return JSON.parse(readFileSync(path.join(process.cwd(), relPath), 'utf8'))
}

export function getFeaturedSlugs(): string[] {
  return readJson<{ featured: string[] }>('data/seo/featured-devices.json').featured
}

interface SitemapWave {
  id: number
  note: string
  deviceSlugs: 'featured' | string[]
}

/** Device slugs across all sitemap waves, deduplicated ("featured" resolves to the featured list). */
export function getSitemapDeviceSlugs(): string[] {
  const { waves } = readJson<{ waves: SitemapWave[] }>('data/seo/sitemap-waves.json')
  const slugs = waves.flatMap((w) => (w.deviceSlugs === 'featured' ? getFeaturedSlugs() : w.deviceSlugs))
  return [...new Set(slugs)]
}

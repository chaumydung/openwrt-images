// sitemap.xml route (docs/SEO.md 5): homepage + wave-listed device pages + legal pages, never the full device matrix.
import type { MetadataRoute } from 'next'
import { getSitemapDeviceSlugs, siteUrl } from '@/lib/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  return [
    { url: `${base}/`, priority: 1.0, changeFrequency: 'weekly' },
    ...getSitemapDeviceSlugs().map((slug) => ({
      url: `${base}/device/${slug}`,
      priority: 0.8,
      changeFrequency: 'weekly' as const,
    })),
    { url: `${base}/privacy`, priority: 0.3, changeFrequency: 'yearly' },
    { url: `${base}/terms`, priority: 0.3, changeFrequency: 'yearly' },
  ]
}

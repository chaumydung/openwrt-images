// robots.txt route (docs/SEO.md 6): allow all, block non-content paths, point to sitemap.xml.
import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/builds/', '/_next/'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}

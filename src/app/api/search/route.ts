// GET /api/search?q= — top 12 device matches for the homepage autocomplete, served from the committed catalog.
import { getCatalog, searchDevices } from '@/lib/catalog'

export function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  const results = q
    ? searchDevices(getCatalog().devices, q, 12).map((d) => ({
        slug: d.slug,
        vendor: d.vendor,
        model: d.model,
        variant: d.variant,
        distros: [...new Set(d.builds.map((b) => b.distro))],
      }))
    : []
  return Response.json(results, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}

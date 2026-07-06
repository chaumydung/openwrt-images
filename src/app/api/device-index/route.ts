// GET /api/device-index — compact static device index (slug/vendor/model/variant + per-distro
// build refs, no image lists) consumed by the homepage builder's client-side device picker.
// Prerendered at build time from the committed catalog; refreshed by the daily sync deploy.
import { getCatalog } from '@/lib/catalog'

export const dynamic = 'force-static'

export function GET() {
  const devices = getCatalog().devices.map((d) => ({
    slug: d.slug,
    vendor: d.vendor,
    model: d.model,
    variant: d.variant,
    builds: d.builds.map(({ distro, version, target, profileId }) => ({ distro, version, target, profileId })),
  }))
  return Response.json(devices, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}

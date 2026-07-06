// GET /api/packages?distro=&version=&target= — categorized package catalog for the builder, fetched on demand from the upstream downloads site.
import { categorize, fetchPackageIndex, resolveArch, UpstreamError, UpstreamNotFoundError } from '@/lib/packages'

// Whitelist formats so only well-formed upstream paths can be built from user input (anti-SSRF).
const VERSION_RE = /^\d+\.\d+(\.\d+)?(-rc\d+)?$/
const TARGET_RE = /^[a-z0-9]+\/[a-z0-9-]+$/

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const distro = params.get('distro') ?? ''
  const version = params.get('version') ?? ''
  const target = params.get('target') ?? ''

  if (distro !== 'openwrt' && distro !== 'immortalwrt') {
    return Response.json({ error: 'distro must be "openwrt" or "immortalwrt"' }, { status: 400 })
  }
  if (!VERSION_RE.test(version)) {
    return Response.json({ error: 'version must be a release number like "24.10.2"' }, { status: 400 })
  }
  if (!TARGET_RE.test(target)) {
    return Response.json({ error: 'target must be "<target>/<subtarget>" like "x86/64"' }, { status: 400 })
  }

  try {
    const arch = await resolveArch(distro, version, target)
    const packages = await fetchPackageIndex(distro, version, target)
    return Response.json(
      { arch, categories: categorize(packages), total: packages.length },
      { headers: { 'Cache-Control': 'public, max-age=3600' } },
    )
  } catch (err) {
    if (err instanceof UpstreamNotFoundError) {
      return Response.json({ error: 'No package index upstream for this distro/version/target' }, { status: 404 })
    }
    if (err instanceof UpstreamError) {
      return Response.json({ error: 'Upstream package index unavailable' }, { status: 502 })
    }
    throw err
  }
}

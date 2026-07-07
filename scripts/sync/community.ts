// Refreshes data/packages/community.json `latest` snapshots: for github-release and tarball
// components it queries the latest release and records every asset verbatim (name + url); which
// asset to actually use is decided later by the resolver, which knows the target arch/version/format.
// feed components pass through unchanged.
import type { CommunityComponent } from '../../src/lib/community-packages'

type Asset = { name: string; browser_download_url: string }
type Release = { tag_name: string; assets: Asset[] }

export function recordReleaseAssets(release: Release): { name: string; url: string }[] {
  return release.assets.map((a) => ({ name: a.name, url: a.browser_download_url }))
}

export async function syncCommunity(
  components: CommunityComponent[],
  fetchImpl: typeof fetch,
): Promise<CommunityComponent[]> {
  const out: CommunityComponent[] = []
  for (const c of components) {
    if (c.sourceType !== 'github-release' && c.sourceType !== 'tarball') {
      out.push(c)
      continue
    }
    try {
      const res = await fetchImpl(`https://api.github.com/repos/${c.githubRepo}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' },
      })
      if (!res.ok) {
        out.push(c)
        continue
      }
      const release = (await res.json()) as Release
      out.push({ ...c, latest: { version: release.tag_name, assets: recordReleaseAssets(release) } })
    } catch {
      out.push(c) // best-effort: keep previous snapshot on failure
    }
  }
  return out
}

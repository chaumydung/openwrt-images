// Refreshes data/packages/community.json `latest` snapshots: for github-release and tarball
// components it queries the recent releases and records every asset verbatim (name + url), newest
// release first, deduped by name. Scanning several recent releases (not just the latest) means a
// component that drops a package format in a newer release — e.g. luci-theme-argon, whose newest
// release ships only .apk while an older one still has the _all.ipk — still resolves on both the
// ipk (≤24.10) and apk (25.x) build lines. Which asset to actually use is decided later by the
// resolver, which knows the target arch/version/format and picks the first (newest) match.
// feed components pass through unchanged.
import type { CommunityComponent } from '../../src/lib/community-packages'

type Asset = { name: string; browser_download_url: string }
type Release = { tag_name: string; draft?: boolean; assets: Asset[] }

// How many recent releases to scan for assets. Enough to recover a format an active project only
// kept in an older release, without pulling in a large amount of history.
const RECENT_RELEASES = 8

/** Assets across the given releases (already newest-first), deduped by name — first (newest) wins. */
export function recordReleaseAssets(releases: Release[]): { name: string; url: string }[] {
  const seen = new Set<string>()
  const out: { name: string; url: string }[] = []
  for (const release of releases) {
    for (const a of release.assets) {
      if (seen.has(a.name)) continue
      seen.add(a.name)
      out.push({ name: a.name, url: a.browser_download_url })
    }
  }
  return out
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
      const res = await fetchImpl(
        `https://api.github.com/repos/${c.githubRepo}/releases?per_page=${RECENT_RELEASES}`,
        { headers: { Accept: 'application/vnd.github+json' } },
      )
      if (!res.ok) {
        out.push(c)
        continue
      }
      const releases = ((await res.json()) as Release[]).filter((r) => !r.draft)
      if (releases.length === 0) {
        out.push(c)
        continue
      }
      out.push({ ...c, latest: { version: releases[0].tag_name, assets: recordReleaseAssets(releases) } })
    } catch {
      out.push(c) // best-effort: keep previous snapshot on failure
    }
  }
  return out
}

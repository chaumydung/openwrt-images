// Refreshes data/packages/community.json `latest` snapshots: for github-release components it
// queries the latest release and records _all asset URLs (main + i18n); feed components pass through.
import type { CommunityComponent } from '../../src/lib/community-packages'

type Asset = { name: string; browser_download_url: string }
type Release = { tag_name: string; assets: Asset[] }

function pickAll(assets: Asset[], base: string): string | null {
  // Prefer the arch-independent `_all` package (ipk or apk); accept both name shapes seen in the wild.
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[-_].*(_all\\.ipk|-.*\\.apk|_all\\.apk)$`)
  return assets.find((a) => re.test(a.name))?.browser_download_url ?? null
}

export function parseReleaseAssets(
  component: CommunityComponent,
  release: Release,
  langs: readonly string[],
): { version: string; assets: Record<string, string> } {
  const assets: Record<string, string> = {}
  for (const pkg of component.packages) {
    const url = pickAll(release.assets, pkg)
    if (url) assets[pkg] = url
    for (const lang of component.i18nAvailable.filter((l) => langs.includes(l))) {
      const i18nBase = pkg.replace(/^luci-app-/, 'luci-i18n-') + `-${lang}`
      const i18nUrl = pickAll(release.assets, i18nBase)
      if (i18nUrl) assets[`${pkg.replace(/^luci-app-/, 'luci-i18n-')}-${lang}`] = i18nUrl
    }
  }
  return { version: release.tag_name, assets }
}

export async function syncCommunity(
  components: CommunityComponent[],
  fetchImpl: typeof fetch,
): Promise<CommunityComponent[]> {
  const langs = ['zh-cn', 'zh-tw', 'ru']
  const out: CommunityComponent[] = []
  for (const c of components) {
    if (c.sourceType !== 'github-release') {
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
      out.push({ ...c, latest: parseReleaseAssets(c, release, langs) })
    } catch {
      out.push(c) // best-effort: keep previous snapshot on failure
    }
  }
  return out
}

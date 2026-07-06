// Discovers a distro's latest stable release version from its downloads site.
import { fetchJson, fetchText, HttpNotFoundError } from './http'
import type { DistroConfig } from './types'

export function parseIndexHrefs(html: string): string[] {
  // Autoindex pages link directories as <a href="name/">; strip the trailing slash.
  return [...html.matchAll(/href="([^"/?][^"?]*?)\/?"/g)]
    .map((m) => m[1])
    .filter((name) => !name.startsWith('.') && !name.includes('/'))
}

export function pickLatestStable(versionDirs: string[]): string | null {
  const stable = versionDirs.filter((v) => /^\d+\.\d+\.\d+$/.test(v))
  if (stable.length === 0) return null
  return stable.sort((a, b) => {
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)
    return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2]
  })[stable.length - 1]
}

export async function discoverStableVersion(distro: DistroConfig): Promise<string> {
  try {
    const meta = await fetchJson<{ stable_version?: string }>(`${distro.baseUrl}/.versions.json`)
    if (meta.stable_version && /^\d+\.\d+\.\d+$/.test(meta.stable_version)) return meta.stable_version
  } catch (err) {
    if (!(err instanceof HttpNotFoundError)) throw err
  }
  const html = await fetchText(`${distro.baseUrl}/releases/`)
  const version = pickLatestStable(parseIndexHrefs(html))
  if (!version) throw new Error(`No stable version found for ${distro.id}`)
  return version
}

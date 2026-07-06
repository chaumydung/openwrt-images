// On-demand upstream package index per (distro, version, target), cached daily via the Next fetch data
// cache. Parses Debian-style Packages manifests (<= 24.10) with APK index.json fallback (25.12+).
import { readFileSync } from 'node:fs'
import path from 'node:path'

export type Distro = 'openwrt' | 'immortalwrt'

export type PackageEntry = {
  name: string
  version: string
  section: string
  sizeBytes: number
  description: string
  feed: string
}

export type PackageCategory = { name: string; packages: PackageEntry[] }

export class UpstreamNotFoundError extends Error {}
export class UpstreamError extends Error {}

export const UPSTREAM_TIMEOUT_MS = 15000
const REVALIDATE_SECONDS = 86400
const ARCH_FEEDS = ['base', 'packages', 'luci']

let baseUrls: Record<string, string> | null = null

function baseUrl(distro: Distro): string {
  if (!baseUrls) {
    const configs = JSON.parse(readFileSync(path.join(process.cwd(), 'config/distros.json'), 'utf8')) as { id: string; baseUrl: string }[]
    baseUrls = Object.fromEntries(configs.map((c) => [c.id, c.baseUrl]))
  }
  return baseUrls[distro]
}

// Explicit timeout wrapper (instead of AbortSignal) so the fetch options stay cacheable by Next.
function withTimeout(promise: Promise<Response>, ms: number, url: string): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new UpstreamError(`Upstream timeout after ${ms}ms: ${url}`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

async function fetchUpstream(url: string): Promise<Response> {
  let res: Response
  try {
    res = await withTimeout(fetch(url, { next: { revalidate: REVALIDATE_SECONDS } }), UPSTREAM_TIMEOUT_MS, url)
  } catch (err) {
    if (err instanceof UpstreamError) throw err
    throw new UpstreamError(`Upstream fetch failed: ${url}`, { cause: err })
  }
  if (res.status === 404) throw new UpstreamNotFoundError(`Upstream 404: ${url}`)
  if (!res.ok) throw new UpstreamError(`Upstream HTTP ${res.status}: ${url}`)
  return res
}

export async function resolveArch(distro: Distro, version: string, target: string): Promise<string> {
  const res = await fetchUpstream(`${baseUrl(distro)}/releases/${version}/targets/${target}/profiles.json`)
  const profiles = (await res.json()) as { arch_packages?: string }
  if (!profiles.arch_packages) throw new UpstreamError(`profiles.json is missing arch_packages: ${distro} ${version} ${target}`)
  return profiles.arch_packages
}

// Parses an APK-repo index.json ({"packages": {"<name>": "<version>"}}), the only text index on
// 25.12+ feeds. It carries no section/size/description, so section falls back to the feed name.
export function parseApkIndex(text: string, feed: string): PackageEntry[] {
  const index = JSON.parse(text) as { packages?: Record<string, string> }
  return Object.entries(index.packages ?? {}).map(([name, version]) => ({
    name,
    version,
    section: feed,
    sizeBytes: 0,
    description: '',
    feed,
  }))
}

// Parses a Debian-control-style Packages manifest (blank-line-separated records, "Field: value" lines).
export function parsePackageIndex(text: string, feed: string): PackageEntry[] {
  const entries: PackageEntry[] = []
  for (const block of text.split(/\r?\n\r?\n/)) {
    const fields: Record<string, string> = {}
    for (const line of block.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z][A-Za-z-]*):\s*(.*)$/)
      if (match) fields[match[1]] = match[2]
    }
    if (!fields.Package) continue
    entries.push({
      name: fields.Package,
      version: fields.Version ?? '',
      section: fields.Section ?? '',
      sizeBytes: Number(fields.Size) || 0,
      description: fields.Description ?? '',
      feed,
    })
  }
  return entries
}

// Fetches one feed directory's index: the rich Debian Packages manifest when present (<= 24.10),
// otherwise the APK index.json that replaced it on 25.12+ feeds.
async function fetchFeedIndex(feed: string, dirUrl: string): Promise<PackageEntry[]> {
  try {
    return parsePackageIndex(await (await fetchUpstream(`${dirUrl}/Packages`)).text(), feed)
  } catch (err) {
    if (!(err instanceof UpstreamNotFoundError)) throw err
    return parseApkIndex(await (await fetchUpstream(`${dirUrl}/index.json`)).text(), feed)
  }
}

export async function fetchPackageIndex(distro: Distro, version: string, target: string): Promise<PackageEntry[]> {
  const arch = await resolveArch(distro, version, target)
  const base = baseUrl(distro)
  const sources = [
    // Target-specific packages (incl. kmods) come first so they win the by-name dedupe below.
    { feed: 'target', dirUrl: `${base}/releases/${version}/targets/${target}/packages` },
    ...ARCH_FEEDS.map((feed) => ({ feed, dirUrl: `${base}/releases/${version}/packages/${arch}/${feed}` })),
  ]
  const parsed = await Promise.all(sources.map(({ feed, dirUrl }) => fetchFeedIndex(feed, dirUrl)))
  const byName = new Map<string, PackageEntry>()
  for (const list of parsed) {
    for (const pkg of list) {
      if (!byName.has(pkg.name)) byName.set(pkg.name, pkg)
    }
  }
  return [...byName.values()]
}

function categoryOf(pkg: PackageEntry): string {
  if (pkg.name.startsWith('luci-app-')) return 'LuCI Apps'
  if (pkg.name.startsWith('luci-theme-')) return 'Themes'
  if (pkg.name.startsWith('kmod-')) return 'Kernel Modules'
  if (!pkg.section) return 'Other'
  return pkg.section[0].toUpperCase() + pkg.section.slice(1)
}

export function categorize(pkgs: PackageEntry[]): PackageCategory[] {
  const groups = new Map<string, PackageEntry[]>()
  for (const pkg of pkgs) {
    const name = categoryOf(pkg)
    const group = groups.get(name)
    if (group) group.push(pkg)
    else groups.set(name, [pkg])
  }
  return [...groups.entries()]
    .map(([name, packages]) => ({ name, packages: packages.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

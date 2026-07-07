// Typed readers for the Step 3 catalogs: curated official packages (data/packages/curated.json)
// and vetted non-official community add-ons (data/packages/community.json).
import { readFileSync } from 'node:fs'
import path from 'node:path'

export const SUPPORTED_LANGUAGES = ['en', 'zh-cn', 'zh-tw', 'ru'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export type CuratedCategory = {
  id: string
  label: string
  packages: { name: string; label: string; description: string }[]
}

export type CommunitySource =
  | { sourceType: 'feed'; feed: { name: string; urlTemplate: string; checkSignature: boolean } }
  | { sourceType: 'github-release'; githubRepo: string }

export type CommunityComponent = CommunitySource & {
  id: string
  label: string
  category: 'proxy' | 'dns' | 'theme'
  note: string | null
  packages: string[]
  extraDepends: string[]
  i18nAvailable: string[]
  latest: { version: string | null; assets: Record<string, string> }
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(process.cwd(), 'data/packages', file), 'utf8')) as T
}

let curatedCache: CuratedCategory[] | null = null
export function getCuratedCategories(): CuratedCategory[] {
  if (!curatedCache) curatedCache = readJson<{ categories: CuratedCategory[] }>('curated.json').categories
  return curatedCache
}

let communityCache: CommunityComponent[] | null = null
export function getCommunityComponents(): CommunityComponent[] {
  if (!communityCache) communityCache = readJson<{ components: CommunityComponent[] }>('community.json').components
  return communityCache
}

export function getCommunityComponent(id: string): CommunityComponent | null {
  return getCommunityComponents().find((c) => c.id === id) ?? null
}

export function communityIds(): Set<string> {
  return new Set(getCommunityComponents().map((c) => c.id))
}

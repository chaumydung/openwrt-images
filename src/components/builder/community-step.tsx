'use client'
// Builder step 3 (bottom section) — vetted non-official community add-ons (proxy/DNS, warning
// styled, unselected by default) plus a neutral "Popular themes" subsection and the optional
// UI language selector. Selections flow into builder state as `communityPackages` / `uiLanguage`.
import type { CommunityComponentSummary } from './lib'

type Props = {
  components: CommunityComponentSummary[]
  selected: string[]
  onToggle: (id: string) => void
  languages: string[]
  uiLanguage: string
  onLanguage: (lang: string) => void
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English (default)',
  'zh-cn': '简体中文 (zh-CN)',
  'zh-tw': '繁體中文 (zh-TW)',
  ru: 'Русский (ru)',
}

export default function CommunityStep({ components, selected, onToggle, languages, uiLanguage, onLanguage }: Props) {
  const themes = components.filter((c) => c.category === 'theme')
  const addons = components.filter((c) => c.category !== 'theme')
  const selectedSet = new Set(selected)

  return (
    <div className="mt-6 space-y-5">
      {themes.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-900">Popular themes</p>
          <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {themes.map((c) => (
              <ComponentRow key={c.id} component={c} checked={selectedSet.has(c.id)} onToggle={onToggle} />
            ))}
          </ul>
        </div>
      )}

      {addons.length > 0 && (
        <div className="rounded-lg border border-amber-700/40 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Community add-ons</p>
          <p className="mt-1 text-xs text-amber-800">
            Community-maintained add-ons — you are responsible for how you use them.
          </p>
          <ul className="mt-3 divide-y divide-amber-700/20 rounded-md border border-amber-700/30 bg-white">
            {addons.map((c) => (
              <ComponentRow key={c.id} component={c} checked={selectedSet.has(c.id)} onToggle={onToggle} />
            ))}
          </ul>
        </div>
      )}

      <div>
        <label htmlFor="builder-ui-language" className="text-sm font-medium text-slate-900">
          UI language
        </label>
        <select
          id="builder-ui-language"
          value={uiLanguage}
          onChange={(e) => onLanguage(e.target.value)}
          className="mt-1 w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700"
        >
          {languages.map((lang) => (
            <option key={lang} value={lang}>
              {LANGUAGE_LABELS[lang] ?? lang}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-600">
          Installs the matching translation package for selected add-ons that support it. English installs no extra
          package.
        </p>
      </div>
    </div>
  )
}

function ComponentRow({
  component,
  checked,
  onToggle,
}: {
  component: CommunityComponentSummary
  checked: boolean
  onToggle: (id: string) => void
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-slate-50">
        <input type="checkbox" checked={checked} onChange={() => onToggle(component.id)} className="mt-1 accent-sky-700" />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-slate-900">{component.label}</span>
          {component.note && <span className="mt-0.5 block text-xs text-slate-600">{component.note}</span>}
        </span>
      </label>
    </li>
  )
}

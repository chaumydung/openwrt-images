'use client'
// Builder step 1 — distribution & version radio cards (OpenWrt / ImmortalWrt).
import type { DistroId, DistroOption } from './lib'

const DESCRIPTIONS: Record<string, string> = {
  openwrt: 'The upstream project. Broadest device coverage with the official package feeds.',
  immortalwrt: 'Downstream fork of OpenWrt with extra packages popular in home network setups.',
}

type Props = {
  distros: DistroOption[]
  value: DistroId
  onChange: (distro: DistroId) => void
}

export default function DistroStep({ distros, value, onChange }: Props) {
  return (
    <fieldset>
      <legend className="sr-only">Distribution and version</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {distros.map((d) => (
          <label
            key={d.id}
            className={`flex cursor-pointer flex-col gap-1 rounded-lg border bg-white p-4 transition-colors ${
              value === d.id ? 'border-sky-600 ring-1 ring-sky-600' : 'border-slate-200 hover:border-sky-600'
            }`}
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name="builder-distro"
                value={d.id}
                checked={value === d.id}
                onChange={() => onChange(d.id)}
                className="accent-sky-700"
              />
              <span className="text-base font-semibold text-slate-900">{d.label}</span>
              <span className="ml-auto rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-mono text-xs text-slate-600">
                {d.version}
              </span>
            </span>
            <span className="pl-6 text-sm leading-relaxed text-slate-600">{DESCRIPTIONS[d.id] ?? ''}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

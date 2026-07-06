// Pure-CSS terminal window chrome (three-dot title bar + dark body), per docs/DESIGN.md v2.
// No 'use client': renders server-side on the homepage hero and inlines into the client
// build-log stream with identical visual parameters. Zero images, zero dependencies.
import type { ReactNode } from 'react'

export function TerminalWindow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-ink-border bg-ink">
      <div className="flex items-center gap-1.5 border-b border-ink-border bg-ink-panel px-4 py-2.5">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
        <span className="ml-2 truncate font-mono text-xs text-slate-400">{title}</span>
      </div>
      {children}
    </div>
  )
}

// Decorative fake build log for the homepage hero (aria-hidden: it is a visual brand
// anchor, not content). Line shape mirrors a real ImageBuilder run.
const HERO_LOG_LINES: { prompt?: boolean; text: string; className?: string }[] = [
  { prompt: true, text: 'make image PROFILE=glinet_gl-mt3000 \\' },
  { text: '    PACKAGES="luci luci-app-sqm wireguard-tools"' },
  { text: 'Building images for mediatek/filogic - glinet_gl-mt3000', className: 'text-slate-400' },
  { text: ' * packages: 214 resolved (12.4 MB)', className: 'text-slate-400' },
  { text: ' * writing squashfs-sysupgrade.itb ... done', className: 'text-slate-400' },
  { text: 'sha256sum: 9f3e1c07ab52  sysupgrade.itb', className: 'text-slate-400' },
  { text: 'build finished in 3m 41s', className: 'text-green-400' },
]

export function HeroTerminal() {
  return (
    <TerminalWindow title="imagebuilder — build.log">
      <pre aria-hidden="true" className="overflow-x-auto p-4 font-mono text-[13px] leading-6 text-slate-200">
        {HERO_LOG_LINES.map((line, i) => (
          <span key={i} className={`block ${line.className ?? ''}`}>
            {line.prompt && <span className="text-green-400">$ </span>}
            {line.text}
          </span>
        ))}
      </pre>
    </TerminalWindow>
  )
}

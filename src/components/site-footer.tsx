// Site-wide footer: dark band echoing the hero — brand column, mono uppercase column
// titles (legal / upstream), and the collapsible feedback form.
import Link from 'next/link'
import { FeedbackForm } from './feedback-form'

const upstreamLinks = [
  { label: 'OpenWrt on GitHub', href: 'https://github.com/openwrt/openwrt' },
  { label: 'ImmortalWrt on GitHub', href: 'https://github.com/immortalwrt/immortalwrt' },
  { label: 'downloads.openwrt.org', href: 'https://downloads.openwrt.org' },
  { label: 'downloads.immortalwrt.org', href: 'https://downloads.immortalwrt.org' },
]

const columnTitleClass = 'font-mono text-xs uppercase tracking-widest text-slate-400'
const footerLinkClass = 'text-sm text-slate-400 hover:text-white hover:underline'

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-ink-border bg-ink">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <p className="text-sm font-semibold text-white">OpenWrt Online Builder</p>
          <p className="mt-3 text-sm/6 text-slate-400">
            Build custom OpenWrt and ImmortalWrt firmware images in your browser, assembled from the official upstream
            packages.
          </p>
          <p className="mt-4 text-xs/5 text-slate-400">
            Not affiliated with the OpenWrt or ImmortalWrt projects. Trademarks belong to their respective owners.
          </p>
        </div>
        <nav aria-label="Legal">
          <p className={columnTitleClass}>Legal</p>
          <ul className="mt-4 flex flex-col gap-2.5">
            <li>
              <Link href="/privacy" className={footerLinkClass}>
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className={footerLinkClass}>
                Terms of Service
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Upstream projects">
          <p className={columnTitleClass}>Upstream</p>
          <ul className="mt-4 flex flex-col gap-2.5">
            {upstreamLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} target="_blank" rel="noopener noreferrer" className={footerLinkClass}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className={columnTitleClass}>Contact</p>
          <div className="mt-4">
            <FeedbackForm />
          </div>
        </div>
      </div>
    </footer>
  )
}

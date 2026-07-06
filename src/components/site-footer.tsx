// Site-wide footer: descriptive brand line, legal + upstream links, and the collapsible feedback form.
import Link from 'next/link'
import { FeedbackForm } from './feedback-form'

const upstreamLinks = [
  { label: 'OpenWrt on GitHub', href: 'https://github.com/openwrt/openwrt' },
  { label: 'ImmortalWrt on GitHub', href: 'https://github.com/immortalwrt/immortalwrt' },
  { label: 'downloads.openwrt.org', href: 'https://downloads.openwrt.org' },
  { label: 'downloads.immortalwrt.org', href: 'https://downloads.immortalwrt.org' },
]

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-4xl gap-8 px-6 py-10 sm:grid-cols-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">OpenWrt Online Builder</p>
          <p className="mt-2 text-sm text-slate-600">
            Build custom OpenWrt and ImmortalWrt firmware images in your browser, assembled from the official upstream
            packages.
          </p>
          <p className="mt-3 text-xs text-slate-600">
            Not affiliated with the OpenWrt or ImmortalWrt projects. Trademarks belong to their respective owners.
          </p>
        </div>
        <nav aria-label="Footer" className="text-sm">
          <ul className="flex flex-col gap-2">
            <li>
              <Link href="/privacy" className="text-slate-600 hover:text-[#0369A1] hover:underline">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-slate-600 hover:text-[#0369A1] hover:underline">
                Terms of Service
              </Link>
            </li>
            {upstreamLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-600 hover:text-[#0369A1] hover:underline"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <FeedbackForm />
        </div>
      </div>
    </footer>
  )
}

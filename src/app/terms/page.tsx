// /terms — static legal page: as-is service, flashing risk, upstream attribution, quotas (docs/PRD.md 4.1).
import type { Metadata } from 'next'
import { LegalArticle, type LegalSection } from '@/components/legal-article'
import { siteUrl } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Terms of Service | OpenWrt Online Builder',
  description:
    'Terms for this OpenWrt / ImmortalWrt online firmware builder: no warranty, flashing at your own risk, daily build quotas, and upstream trademark attribution.',
  alternates: { canonical: `${siteUrl()}/terms` },
}

const sections: LegalSection[] = [
  {
    heading: 'The service',
    paragraphs: [
      'This site assembles OpenWrt and ImmortalWrt firmware images from the official precompiled packages published by each project, using their standard ImageBuilder tooling. Anyone can download prebuilt images. Registered users can request one custom build per day. By using the site you accept these terms.',
    ],
  },
  {
    heading: 'No warranty',
    paragraphs: [
      'The service and every image it produces are provided as is, without warranty of any kind, express or implied. We do not guarantee that a build will succeed, that an image will boot, or that the service will be available at any particular time. A successful build does not mean the image is correct for your hardware.',
    ],
  },
  {
    heading: 'Flashing is at your own risk',
    paragraphs: [
      'Flashing firmware can permanently damage ("brick") a device, void its warranty, or cause data loss. You are responsible for confirming that an image matches your exact hardware revision before installing it, and you install it entirely at your own risk. To the maximum extent permitted by law, we are not liable for any damage caused by images downloaded from this site.',
    ],
  },
  {
    heading: 'Open source and trademarks',
    paragraphs: [
      'Images are assembled from unmodified packages built and published by the OpenWrt and ImmortalWrt projects. The corresponding source code is available from those projects, and the licenses of the included software, including the GNU GPL, continue to apply.',
      'OpenWrt, ImmortalWrt, and the device names shown on this site are trademarks of their respective owners. We use these names only to describe what the service builds and which hardware it targets. This site is an independent tool and is not affiliated with, endorsed by, or sponsored by the OpenWrt project or the ImmortalWrt project.',
    ],
  },
  {
    heading: 'Quotas and fair use',
    paragraphs: [
      'Anonymous visitors may download prebuilt images without limit. Custom builds require signing in with GitHub and are limited to one per user per day. Do not use scripts or multiple accounts to bypass this limit, resell build capacity, or use the service for anything illegal. We may throttle, suspend, or delete accounts that abuse the service, and we may change quotas as capacity requires.',
    ],
  },
  {
    heading: 'Build artifacts',
    paragraphs: [
      'Firmware images from custom builds are kept for 24 hours after the build finishes, then deleted. If a download link has expired, run the build again.',
      'Custom build specifications and logs are publicly visible on GitHub Actions; the Privacy Policy explains exactly what that includes.',
    ],
  },
  {
    heading: 'Changes',
    paragraphs: [
      'We may update these terms as the service evolves. Meaningful changes will appear on this page with a new date. Questions about these terms: [Contact email].',
    ],
  },
]

export default function TermsPage() {
  return <LegalArticle title="Terms of Service" updated="July 6, 2026" sections={sections} />
}

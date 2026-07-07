// /privacy — static legal page describing what data the service collects (docs/PRD.md 4.1).
import type { Metadata } from 'next'
import { LegalArticle, type LegalSection } from '@/components/legal-article'
import { siteUrl } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Privacy Policy | OpenWrt Online Builder',
  description:
    'What data this OpenWrt / ImmortalWrt firmware builder collects, why custom build logs are public on GitHub Actions, and how long anything is kept.',
  alternates: { canonical: `${siteUrl()}/privacy` },
}

const sections: LegalSection[] = [
  {
    heading: 'Overview',
    paragraphs: [
      'This site builds OpenWrt and ImmortalWrt firmware images. This page describes what data the service collects when you use it and what happens to that data. We collect as little as the service needs to function.',
    ],
  },
  {
    heading: 'Account data',
    paragraphs: [
      'You can browse the site and download prebuilt images without an account. If you sign in to request a custom build, sign-in happens through GitHub OAuth. We store your GitHub account ID, your GitHub username, and the date your account was created here. We never see your GitHub password, and we do not read your email address, repositories, or anything else from your GitHub account.',
    ],
  },
  {
    heading: 'Custom builds run in public',
    paragraphs: [
      'Custom builds are executed on public GitHub Actions infrastructure. The build specification you submit (device model, selected packages, hostname, time zone, LAN IP address, root password, WiFi name and password) and the full build log are publicly visible on GitHub.',
      'The build form only accepts settings that matter inside your local network, and it deliberately rejects anything that could be exploited remotely, such as VPN keys, proxy subscriptions, or dynamic DNS credentials. Still: do not type anything into the build form that you would not want to appear in a public log. If you preset a root or WiFi password, consider changing it after the first boot.',
    ],
  },
  {
    heading: 'Feedback',
    paragraphs: [
      'If you use the feedback form, we store the name, email address, and message you submit, and use them only to read and answer your feedback.',
    ],
  },
  {
    heading: 'Analytics',
    paragraphs: [
      'We use Google Tag Manager and Google Analytics 4 to understand how the site is used: pages visited, rough location, browser type. Analytics runs only on the production site. We do not run advertising trackers, and we set no cookies beyond those used by this analytics setup.',
    ],
  },
  {
    heading: 'Retention',
    paragraphs: [
      'Firmware images produced by custom builds are deleted 24 hours after the build finishes. Records of your builds and daily quota counters are kept so quotas work. Feedback messages are kept until they have been handled.',
    ],
  },
  {
    heading: 'Sharing',
    paragraphs: [
      'We do not sell or rent any of this data. It is processed by the infrastructure the service runs on: GitHub for builds, our hosting and storage providers for the site and firmware images, and Google for analytics.',
    ],
  },
  {
    heading: 'Contact',
    paragraphs: [
      'To ask about your data, or to request deletion of your account or a feedback message, contact us at [Contact email].',
    ],
  },
]

export default function PrivacyPage() {
  return <LegalArticle title="Privacy Policy" updated="July 6, 2026" sections={sections} />
}

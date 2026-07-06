// Homepage landing copy, FAQ, and JSON-LD builders — single source for page rendering and the SEO copy tests.

export const HERO_TITLE = 'OpenWrt Online Builder — Custom Firmware Images'

export const HERO_SUBTITLE =
  'Search your router, pick packages, and download a custom-built OpenWrt or ImmortalWrt image — no local ImageBuilder setup required.'

export const META_DESCRIPTION =
  'Free OpenWrt online builder: pick from 1,900+ router profiles, choose packages, set the basics, and download a custom OpenWrt or ImmortalWrt image in minutes.'

export const HOW_IT_WORKS = [
  {
    title: 'Pick your device',
    body: 'Search 1,900+ official device profiles by vendor or model number and pick the exact hardware you want to flash.',
  },
  {
    title: 'Choose packages',
    body: 'Select a distribution, add LuCI apps, themes, and drivers, and set hostname, LAN IP, time zone, and root password.',
  },
  {
    title: 'Download your image',
    body: 'The build runs server-side in minutes. Download sysupgrade or factory images with sha256 checksums and the full build log.',
  },
] as const

export type CopySection = {
  heading: string
  level: 2 | 3
  paragraphs: string[]
}

export const SECTIONS: CopySection[] = [
  {
    heading: 'What is this OpenWrt online builder?',
    level: 2,
    paragraphs: [
      'This OpenWrt online builder assembles custom firmware images for more than 1,900 router and single-board-computer profiles, directly from your browser. Instead of setting up the ImageBuilder toolchain on a Linux machine, you pick a device, select the packages you need, set a few network basics, and the OpenWrt online builder produces a flashable image in minutes.',
      'Under the hood, the OpenWrt online builder drives the official ImageBuilder: it assembles precompiled packages from downloads.openwrt.org and downloads.immortalwrt.org into a firmware image, so the binaries you flash are exactly the ones the upstream projects publish. The OpenWrt online builder adds the convenience layer on top — device search, package browsing, and sane configuration defaults.',
    ],
  },
  {
    heading: 'Who is the OpenWrt online builder for?',
    level: 3,
    paragraphs: [
      "The typical OpenWrt online builder user runs a home lab, a travel router, or an x86 soft router and wants firmware trimmed to the exact package set the hardware can hold. If you have ever hit a 'no space left on device' error while installing LuCI apps on a router with 16 MB of flash, an OpenWrt online builder that bakes packages into the image solves that problem at the root.",
      'It is equally useful for Raspberry Pi and NanoPi boards and for mainstream TP-Link, Xiaomi, GL.iNet, Linksys, and Netgear routers — every device profile published by the upstream projects is searchable in the OpenWrt online builder.',
    ],
  },
  {
    heading: 'How to use the OpenWrt online builder',
    level: 2,
    paragraphs: [
      "Step 1 — Find your device. Type the model into the search box above. The OpenWrt online builder matches official profile names, so 'gl-mt3000' and 'GL.iNet Beryl AX' both resolve to the same device profile.",
      'Step 2 — Pick a distribution and packages. Choose OpenWrt or ImmortalWrt, then add LuCI applications, themes, VPN clients, and drivers in the package browser of the OpenWrt online builder, or start from a preset package group.',
      'Step 3 — Set the basics. The OpenWrt online builder bakes hostname, LAN IP address, time zone, and root password into the image, so the router comes up configured after the first boot.',
      'Step 4 — Build and download. The OpenWrt online builder runs an ImageBuilder job, streams the full build log, and returns sysupgrade and factory images with sha256 checksums. A typical OpenWrt online builder job finishes in one to five minutes.',
    ],
  },
  {
    heading: 'Why choose this OpenWrt online builder',
    level: 2,
    paragraphs: [
      'Two distributions in one OpenWrt online builder. The official firmware selector covers OpenWrt only; this OpenWrt online builder also covers ImmortalWrt and its larger package feeds, so you can compare both options for your device on one page.',
      'No local build environment. Running ImageBuilder yourself requires a Linux x86_64 host, several gigabytes of disk, and command-line work. The OpenWrt online builder removes that setup entirely: the build runs server-side and you only download the result.',
      'Prebuilt images updated daily. For featured devices, the OpenWrt online builder publishes default prebuilt images every day, free to download without an account, each with a sha256 checksum.',
      'Transparent builds. Every OpenWrt online builder job returns its complete build log, so package dependency conflicts or an image that exceeds the flash size of the device are diagnosed from evidence, not guesswork.',
    ],
  },
  {
    heading: 'ImmortalWrt support in the OpenWrt online builder',
    level: 2,
    paragraphs: [
      'ImmortalWrt is a downstream fork of OpenWrt that ships extra packages popular in home network setups while keeping the same ImageBuilder workflow. The OpenWrt online builder treats it as a first-class distribution: device search shows which distributions support your hardware, and the package browser switches feeds accordingly.',
      'Version coverage in the OpenWrt online builder follows the latest stable release of each distribution, synced daily from the official download servers, so the device profiles and package lists never drift from upstream.',
    ],
  },
]

export const FAQ_HEADING = 'OpenWrt online builder FAQ'

export const FAQ: { question: string; answer: string }[] = [
  {
    question: 'What is the difference between sysupgrade and factory images?',
    answer:
      "A factory image installs OpenWrt for the first time from the vendor's stock firmware; a sysupgrade image updates a router that already runs OpenWrt while keeping its settings. The OpenWrt online builder produces both formats whenever the device profile provides them.",
  },
  {
    question: 'How long does a build take in the OpenWrt online builder?',
    answer:
      'Most jobs finish in one to five minutes. The OpenWrt online builder uses the official ImageBuilder, which assembles precompiled packages instead of compiling source code, so build time stays short even with large package sets.',
  },
  {
    question: 'Is the OpenWrt online builder free?',
    answer:
      'Yes. Downloading prebuilt default images requires no account and has no download limit. Custom builds in the OpenWrt online builder require a free GitHub sign-in and are covered by a daily quota. There is no paid tier in the current version.',
  },
  {
    question: 'How many custom builds can I run per day?',
    answer:
      'Registered users get one custom build per day in the OpenWrt online builder, and the quota resets at 00:00 UTC. If a build fails for a system-side reason, the quota is refunded automatically; failures caused by your package selection are not refunded.',
  },
  {
    question: 'How do I verify that a downloaded image is safe?',
    answer:
      'Every image built by the OpenWrt online builder ships with a sha256 checksum. Compare it with the sha256sum command before flashing. The service only assembles packages signed and published by the upstream projects, so the binary content matches the official feeds.',
  },
  {
    question: 'Where is the source code for the firmware (GPL)?',
    answer:
      'Images are assembled from unmodified upstream binary packages. Source code for OpenWrt and ImmortalWrt is available from the official project repositories, and every device page links back to the upstream project for GPL compliance.',
  },
  {
    question: 'Why did my build fail?',
    answer:
      'The two most common causes are package dependency conflicts and an image that exceeds the flash capacity of the device. The OpenWrt online builder returns the full build log for every failed job and flags both conditions, so you can drop or swap the offending packages and rebuild.',
  },
]

// JSON-LD for the homepage: SoftwareApplication + FAQPage (mirrors the visible FAQ) + Organization.
export function buildHomeJsonLd(url: string) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'OpenWrt Online Builder',
      description: META_DESCRIPTION,
      url,
      applicationCategory: 'WebApplication',
      operatingSystem: 'Any',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Custom Firmware Image Builder',
      url,
    },
  ]
}

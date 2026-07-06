// /builds/[id]: build progress page — thin server shell, CSR body, noindex (docs/SEO.md).
import type { Metadata } from 'next'
import Link from 'next/link'
import { BuildStatus } from './build-status'

export const metadata: Metadata = {
  title: 'Build status',
  robots: { index: false, follow: false },
  // Suppress the canonical inherited from the root layout: a canonical pointing elsewhere
  // must never be combined with noindex (docs/SEO.md).
  alternates: { canonical: null },
}

export default async function BuildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="flex-1 bg-slate-50 text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <nav aria-label="Breadcrumb" className="mx-auto w-full max-w-4xl px-4 py-3 sm:px-6">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
            <li>
              <Link href="/" className="hover:text-sky-700 hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-slate-900">
              Build status
            </li>
          </ol>
        </nav>
      </div>
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-widest text-sky-700">Build job</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Build status</h1>
        <BuildStatus id={id} />
      </main>
    </div>
  )
}

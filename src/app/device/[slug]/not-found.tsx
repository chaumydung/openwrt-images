// 404 fallback for unknown device slugs (task U5): short message + routes back to search.
import Link from 'next/link'

export default function DeviceNotFound() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-mono text-sm text-slate-600">404</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Device not found</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        This device is not in the catalog. It may have been renamed upstream, or it is not supported by the current
        OpenWrt / ImmortalWrt stable releases.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
      >
        Search for your device
      </Link>
      <Link
        href="/"
        className="mt-3 text-sm text-slate-900 underline decoration-slate-300 underline-offset-2 hover:text-sky-700 hover:decoration-sky-600"
      >
        Back to the homepage
      </Link>
    </main>
  )
}

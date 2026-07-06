import { getCatalog, searchDevices } from '@/lib/catalog'

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams
  const { devices, meta } = getCatalog()
  const results = searchDevices(devices, q)
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">OpenWrt / ImmortalWrt Firmware Builder</h1>
      <p className="mt-2 text-sm">
        {devices.length} devices across {meta.distros.map((d) => `${d.id} ${d.version}`).join(' and ')}
      </p>
      <form method="GET" className="mt-6">
        <input name="q" defaultValue={q} placeholder="Search your device model..." className="w-full border p-2" />
      </form>
      <ul className="mt-4">
        {results.map((d) => (
          <li key={d.slug} className="border-b py-2">
            {d.vendor} {d.model} {d.variant ?? ''} — {d.builds.map((b) => b.distro).join(', ')}
          </li>
        ))}
      </ul>
    </main>
  )
}

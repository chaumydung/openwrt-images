// Prebuilt-images sub-section of the device page's Download Images block (PRD 5): renders this
// site's daily prebuilt variants from R2 metadata (fixtures in mock mode); renders nothing when
// the device has no prebuilt data. Server component, filling the id="prebuilt-images" slot.
import type { CatalogDevice } from '@/lib/catalog'
import { imageTypeHint } from '@/lib/device-page'
import { getPrebuiltImages } from '@/lib/prebuilt'
import type { PrebuiltImages } from '@/lib/prebuilt'
import { CopyButton } from './copy-button'

// Matches the visual rules of the upstream image tables in page.tsx.
const cardClass = 'rounded-lg border border-slate-200 bg-white'
const thClass = 'px-3 py-2 text-left font-semibold text-slate-900'

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

export async function PrebuiltImagesSection({ device }: { device: CatalogDevice }) {
  const distros = [...new Set(device.builds.map((b) => b.distro))]
  const groups = (
    await Promise.all(
      distros.map(async (distro) => ({ distro, data: await getPrebuiltImages(device.slug, distro) })),
    )
  ).filter((g): g is { distro: (typeof distros)[number]; data: PrebuiltImages } =>
    Boolean(g.data && g.data.variants.length > 0),
  )
  if (groups.length === 0) return null

  return (
    <div id="prebuilt-images" className="mt-4">
      <h3 className="text-sm font-semibold text-slate-900">Prebuilt images (updated daily)</h3>
      <p className="mt-1 text-xs text-slate-600">
        Built daily by this site from official packages with LuCI included — no sign-up needed, unlimited downloads.
      </p>
      {groups.map(({ distro, data }) => (
        <div key={distro} className="mt-2">
          <p className="text-xs text-slate-600">
            {distro === 'openwrt' ? 'OpenWrt' : 'ImmortalWrt'} <span className="font-mono">{data.version}</span> · built{' '}
            <span className="font-mono">{data.buildDate}</span>
          </p>
          <div className={`mt-2 overflow-x-auto ${cardClass}`}>
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className={thClass}>Image</th>
                  <th className={`${thClass} w-24`}>Size</th>
                  <th className={`${thClass} w-44`}>sha256</th>
                </tr>
              </thead>
              <tbody>
                {data.variants.map((v) => {
                  const hint = imageTypeHint(v.hintKey)
                  return (
                    <tr key={v.file} className="border-t border-slate-200 align-top hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <a
                          href={v.url}
                          className="inline-flex items-start gap-1.5 font-mono text-xs break-all text-sky-700 hover:underline"
                        >
                          <svg
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            className="mt-0.5 h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                          >
                            <path d="M8 2v8m0 0 3-3m-3 3L5 7M3 13h10" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          {v.file}
                        </a>
                        {hint && <p className="mt-1 text-xs text-slate-600">{hint}</p>}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{formatSize(v.sizeBytes)}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-slate-600" title={v.sha256}>
                            {v.sha256.slice(0, 12)}…
                          </span>
                          <CopyButton value={v.sha256} label={`Copy sha256 checksum of ${v.file}`} />
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

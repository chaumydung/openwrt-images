// Shared renderer for the /privacy and /terms legal pages: h1 + dated h2 sections of paragraphs.

export type LegalSection = { heading: string; paragraphs: string[] }

export function LegalArticle({
  title,
  updated,
  sections,
}: {
  title: string
  updated: string
  sections: LegalSection[]
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-3 font-mono text-xs uppercase tracking-widest text-slate-500">Last updated: {updated}</p>
      {sections.map((section) => (
        <section key={section.heading}>
          <h2 className="mt-10 text-xl font-semibold text-slate-900">{section.heading}</h2>
          {section.paragraphs.map((text, i) => (
            <p key={i} className="mt-4 text-base/7 text-slate-600">
              {text}
            </p>
          ))}
        </section>
      ))}
    </main>
  )
}

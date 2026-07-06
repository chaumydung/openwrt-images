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
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">Last updated: {updated}</p>
      {sections.map((section) => (
        <section key={section.heading}>
          <h2 className="mt-10 text-xl font-semibold text-slate-900">{section.heading}</h2>
          {section.paragraphs.map((text, i) => (
            <p key={i} className="mt-3 leading-relaxed text-slate-600">
              {text}
            </p>
          ))}
        </section>
      ))}
    </main>
  )
}

import { MOTIF_BOX, MOTIFS, PALETTES } from "@/lib/catalogue";

// Step 1 check: the catalogue loads in the app. Replaced by the chat in Step 4.
export default function Home() {
  const [background, ink] = PALETTES.cool.colors;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-16">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Common Threads</h1>
        <p className="mt-2 text-foreground/70">Catalogue check: the artist&apos;s six motifs and four palettes.</p>
      </header>

      <section className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {Object.values(MOTIFS).map((motif) => (
          <figure key={motif.id} className="flex flex-col items-center gap-2 rounded-lg p-3" style={{ background }}>
            <svg viewBox={`0 0 ${MOTIF_BOX} ${MOTIF_BOX}`} className="h-16 w-16" aria-hidden="true">
              <path d={motif.path} fill={ink} fillRule="evenodd" stroke={ink} strokeWidth={3} strokeLinejoin="round" />
            </svg>
            <figcaption className="text-sm" style={{ color: ink }}>{motif.label}</figcaption>
          </figure>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        {Object.entries(PALETTES).map(([id, palette]) => (
          <div key={id} className="flex items-center gap-3">
            <span className="w-14 text-sm">{palette.label}</span>
            {palette.colors.map((color) => (
              <span key={color} className="h-8 w-8 rounded-full border border-black/10" style={{ background: color }} title={color} />
            ))}
          </div>
        ))}
      </section>
    </main>
  );
}

"use client";

import { useState } from "react";
import { LAYOUTS, MOTIFS, PALETTES, PLACEMENTS } from "@/lib/catalogue";
import { profileToRecipe } from "@/lib/recipe";
import { buildRenderPlan, DEFAULT_LINE_WEIGHT, renderRepeat, svgDataUrl } from "@/lib/render";
import { SAMPLES, type Sample } from "@/lib/samples";
import type { Recipe, RenderPlan } from "@/lib/types";

// Step 2 checks from docs/IMPLEMENTATION_PLAN.md §8.
function checks(recipe: Recipe, plan: RenderPlan) {
  const countsMatch =
    plan.length === PLACEMENTS[recipe.density] &&
    recipe.ingredients.every((ing) => plan.filter((p) => p.motifId === ing.id).length === ing.count);
  const reproducible = JSON.stringify(buildRenderPlan(recipe)) === JSON.stringify(plan);
  return { countsMatch, reproducible };
}

function SampleCard({ sample, seed, lineWeight, showEdges, onReseed }: {
  sample: Sample;
  seed: number;
  lineWeight: number;
  showEdges: boolean;
  onReseed: () => void;
}) {
  const recipe = profileToRecipe(sample.profile, seed);
  const plan = buildRenderPlan(recipe);
  const svg = renderRepeat(recipe, plan, { lineWeight, showTileEdges: showEdges });
  const { countsMatch, reproducible } = checks(recipe, plan);

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white/60 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-medium">{sample.name}</h2>
        <button onClick={onReseed} className="rounded-full border border-black/15 px-3 py-1 text-sm hover:bg-black/5">
          New seed
        </button>
      </div>
      {/* A data-URL image keeps each SVG's ids separate from the page. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={svgDataUrl(svg)} alt={`${sample.name} pattern, 3 × 3 repeat`} className="aspect-square w-full rounded-lg" />
      <div className="flex flex-col gap-1 text-sm">
        <p>
          {recipe.ingredients
            .map((ing) => `${MOTIFS[ing.id].label} ×${ing.count}${ing.role ? ` (${ing.role})` : ""}`)
            .join(" · ")}
        </p>
        <p className="flex items-center gap-1.5 text-foreground/70">
          {PALETTES[recipe.paletteId].colors.map((color) => (
            <span key={color} className="inline-block h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: color }} />
          ))}
          <span className="ml-1">
            {LAYOUTS[recipe.layoutId].label} · {recipe.density} density · {recipe.motifScale} · seed {seed}
          </span>
        </p>
        <p className="text-foreground/70">
          {countsMatch ? "✓" : "✗"} counts match · {reproducible ? "✓" : "✗"} same seed, same tile
        </p>
      </div>
    </article>
  );
}

export default function Lab() {
  const [seeds, setSeeds] = useState<Record<string, number>>(() => Object.fromEntries(SAMPLES.map((s) => [s.id, s.seed])));
  const [lineWeight, setLineWeight] = useState(DEFAULT_LINE_WEIGHT);
  const [showEdges, setShowEdges] = useState(false);

  const reseed = (id: string) => setSeeds((current) => ({ ...current, [id]: current[id] + 1 }));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pattern lab</h1>
          <p className="text-foreground/70">Sample recipes rendered as 3 × 3 repeats, for tuning the drawings and composition rules.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <label className="flex items-center gap-2">
            Line weight
            <input type="range" min={0} max={8} step={0.5} value={lineWeight} onChange={(e) => setLineWeight(Number(e.target.value))} />
            <span className="w-10 tabular-nums">{lineWeight} px</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showEdges} onChange={(e) => setShowEdges(e.target.checked)} />
            Show tile edges
          </label>
          <button
            onClick={() => SAMPLES.forEach((s) => reseed(s.id))}
            className="rounded-full border border-black/15 px-3 py-1 hover:bg-black/5"
          >
            New seeds for all
          </button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SAMPLES.map((sample) => (
          <SampleCard
            key={sample.id}
            sample={sample}
            seed={seeds[sample.id]}
            lineWeight={lineWeight}
            showEdges={showEdges}
            onReseed={() => reseed(sample.id)}
          />
        ))}
      </section>
    </main>
  );
}

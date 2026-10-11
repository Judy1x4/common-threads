"use client";

import { useState } from "react";
import { LAYOUTS, MOTIFS, PALETTES } from "@/lib/catalogue";
import { patternTitle } from "@/lib/recipe";
import { exportPng, renderRepeat, renderScarf, svgDataUrl } from "@/lib/render";
import type { Profile, Recipe, RenderPlan } from "@/lib/types";
import { MotifIcon } from "./motif-icon";

const DENSITY_LABELS = { low: "Spacious", medium: "Balanced", high: "Busy" };

export function ResultView({ profile, recipe, plan, onChangeChoices }: {
  profile: Profile;
  recipe: Recipe;
  plan: RenderPlan;
  onChangeChoices: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const title = patternTitle(profile, recipe);
  const palette = PALETTES[recipe.paletteId];

  async function download() {
    setDownloading(true);
    try {
      const url = URL.createObjectURL(await exportPng(recipe, plan));
      const link = document.createElement("a");
      link.href = url;
      link.download = `common-threads-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm tracking-wide text-foreground/60 uppercase">Your pattern</p>
        <h2 className="font-serif text-4xl">{title}</h2>
        <p className="text-foreground/70">A contemporary pattern composed from the artist&apos;s original hand-drawn motifs.</p>
      </header>

      <div className="grid items-start gap-6 md:grid-cols-[1fr_auto]">
        {/* Data-URL images keep each SVG's ids separate from the page. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={svgDataUrl(renderRepeat(recipe, plan))}
          alt={`${title}: the pattern repeated three times in each direction`}
          className="aspect-square w-full rounded-2xl shadow-sm"
        />
        <figure className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={svgDataUrl(renderScarf(recipe, plan))} alt={`${title} on a scarf`} className="h-[28rem] w-auto md:h-[34rem]" />
          <figcaption className="text-sm text-foreground/60">Scarf preview</figcaption>
        </figure>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={download}
          disabled={downloading}
          className="rounded-full bg-foreground px-6 py-3 text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {downloading ? "Preparing PNG…" : "Download PNG tile"}
        </button>
        <button type="button" onClick={onChangeChoices} className="rounded-full border border-black/15 px-6 py-3 hover:bg-black/5">
          Change choices
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white/60 p-5">
          <h3 className="font-serif text-2xl">Recipe</h3>
          <ul className="flex flex-col gap-2">
            {recipe.ingredients.map((ing) => (
              <li key={ing.id} className="flex items-center gap-3">
                <MotifIcon id={ing.id} color={palette.colors[plan.find((p) => p.motifId === ing.id)?.colorRank ?? 1]} className="h-9 w-9" />
                <span>
                  {MOTIFS[ing.id].label} ×{ing.count}
                  {ing.role && <span className="text-foreground/60"> · {ing.role}</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            {palette.colors.map((color) => (
              <span key={color} className="h-6 w-6 rounded-full border border-black/10" style={{ background: color }} title={color} />
            ))}
            <span className="ml-1">{palette.label} palette</span>
          </div>
          <p className="text-sm text-foreground/70">
            {LAYOUTS[recipe.layoutId].label} arrangement · {DENSITY_LABELS[recipe.density].toLowerCase()} · {recipe.motifScale} motifs · seed {recipe.seed}
          </p>
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white/60 p-5">
          <h3 className="font-serif text-2xl">Why it looks like this</h3>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            {recipe.reasons.map((reason) => (
              <li key={reason.text}>{reason.text}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LAYOUTS, MOTIFS, PALETTES } from "@/lib/catalogue";
import { renderRepeat, renderScarf, renderTile, svgDataUrl } from "@/lib/render";
import type { Design, Origin, Profile } from "@/lib/types";
import { Badge, DENSITY_LABELS, DensityPicker, LayoutPicker, PalettePicker, SCALE_LABELS, ScalePicker, ShapePicker } from "./choices";
import { downloadDesign } from "./download";
import { MotifIcon } from "./motif-icon";

function SettingRow({ label, value, origin, open, onToggle, children }: {
  label: string;
  value: ReactNode;
  origin?: Origin;
  open: boolean;
  onToggle?: () => void;
  children?: ReactNode;
}) {
  return (
    <li className="rounded-xl bg-black/[.04]">
      <button
        type="button"
        onClick={onToggle}
        disabled={!onToggle}
        aria-expanded={onToggle ? open : undefined}
        className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-default"
      >
        <span className="w-24 shrink-0 text-sm text-foreground/60">{label}</span>
        <span className="flex-1">{value}</span>
        {origin && <Badge origin={origin} />}
        {onToggle && <span className={`text-foreground/50 transition ${open ? "rotate-180" : ""}`}>⌄</span>}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </li>
  );
}

// The View panel for a result card. The latest design is editable: each
// change rebuilds it with the same seed. Earlier versions are read-only.
export function RecipePanel({ design, profile, editable, onChange, onChangeChoices, onClose }: {
  design: Design;
  profile: Profile;
  editable: boolean;
  onChange: (profile: Profile) => void;
  onChangeChoices: () => void;
  onClose: () => void;
}) {
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const { recipe, plan } = design;
  const palette = PALETTES[recipe.paletteId];
  const toggle = (row: string) => (editable ? () => setOpenRow(openRow === row ? null : row) : undefined);
  // Badges describe the current choices, so only the latest (editable) design shows them.
  const origin = (field: { origin: Origin } | undefined): Origin | undefined => (editable ? (field?.origin ?? "default") : undefined);
  const picker = { profile, onChange };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadDesign(design);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="design-name"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-3xl flex-col gap-6 rounded-2xl bg-background p-5 shadow-xl sm:p-7"
      >
        <header className="flex items-start gap-4">
          {/* Data-URL images keep each SVG's ids separate from the page. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={svgDataUrl(renderTile(recipe, plan))} alt="" className="h-16 w-16 shrink-0 rounded-xl" />
          <div className="flex-1">
            <h2 id="design-name" className="font-serif text-3xl">{design.name}</h2>
            <p className="mt-1 text-foreground/70">{design.description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl leading-none text-foreground/60 hover:text-foreground">
            ×
          </button>
        </header>

        <div className="grid items-start gap-4 sm:grid-cols-[1fr_auto]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={svgDataUrl(renderRepeat(recipe, plan))} alt={`${design.name}, repeated three times each way`} className="aspect-square w-full rounded-xl" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={svgDataUrl(renderScarf(recipe, plan))} alt={`${design.name} on a scarf`} className="mx-auto h-80 w-auto sm:h-[26rem]" />
        </div>

        <section className="flex flex-col gap-2">
          <h3 className="font-medium">Ingredients</h3>
          <ul className="flex flex-col gap-2">
            {recipe.ingredients.map((ing) => (
              <SettingRow
                key={ing.id}
                label={ing.role ?? "shape"}
                value={
                  <span className="flex items-center gap-2">
                    <MotifIcon id={ing.id} color={palette.colors[plan.find((p) => p.motifId === ing.id)?.colorRank ?? 1]} className="h-7 w-7" />
                    {MOTIFS[ing.id].label} ×{ing.count}
                  </span>
                }
                origin={origin(profile.motifs)}
                open={false}
              />
            ))}
            {editable && (
              <SettingRow label="Shapes" value="Change shapes" open={openRow === "shapes"} onToggle={toggle("shapes")}>
                <ShapePicker {...picker} keepOne />
              </SettingRow>
            )}
            <SettingRow
              label="Colours"
              value={
                <span className="flex items-center gap-2">
                  <span className="flex">
                    {palette.colors.map((color) => (
                      <span key={color} className="-mr-1 h-5 w-5 rounded-full border border-white" style={{ background: color }} />
                    ))}
                  </span>
                  <span className="ml-1">{palette.label}</span>
                </span>
              }
              origin={origin(profile.paletteId)}
              open={openRow === "colours"}
              onToggle={toggle("colours")}
            >
              <PalettePicker {...picker} />
            </SettingRow>
            <SettingRow label="Arrangement" value={LAYOUTS[recipe.layoutId].label} origin={origin(profile.layoutId)} open={openRow === "layout"} onToggle={toggle("layout")}>
              <LayoutPicker {...picker} />
            </SettingRow>
            <SettingRow label="Size" value={SCALE_LABELS[recipe.motifScale]} origin={origin(profile.motifScale)} open={openRow === "size"} onToggle={toggle("size")}>
              <ScalePicker {...picker} />
            </SettingRow>
            <SettingRow label="Density" value={DENSITY_LABELS[recipe.density]} origin={origin(profile.density)} open={openRow === "density"} onToggle={toggle("density")}>
              <DensityPicker {...picker} />
            </SettingRow>
          </ul>
        </section>

        <details className="text-sm">
          <summary className="cursor-pointer text-foreground/70">Why it looks like this</summary>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
            {recipe.reasons.map((reason) => (
              <li key={reason.text}>{reason.text}</li>
            ))}
          </ul>
        </details>

        <footer className="flex flex-wrap gap-3">
          <button type="button" onClick={download} disabled={downloading} className="flex-1 rounded-xl bg-foreground px-6 py-3 text-background hover:opacity-90 disabled:opacity-50">
            {downloading ? "Preparing PNG…" : "Download PNG tile"}
          </button>
          {editable && (
            <button type="button" onClick={onChangeChoices} className="rounded-xl border border-black/15 px-6 py-3 hover:bg-black/5">
              Change choices
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

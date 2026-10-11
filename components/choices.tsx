"use client";

// Controls for the design choices, shared by the review form and the View
// panel. Every change is the user's own, so it is marked explicit.
import type { ReactNode } from "react";
import { LAYOUTS, MOTIFS, PALETTES } from "@/lib/catalogue";
import {
  DENSITIES, LAYOUT_IDS, MOTIF_IDS, MOTIF_SCALES, PALETTE_IDS,
  type Field, type MotifChoice, type MotifId, type Origin, type Profile,
} from "@/lib/types";
import { MotifIcon } from "./motif-icon";

const MAX_MOTIFS = 3;
export const DENSITY_LABELS = { low: "Spacious", medium: "Balanced", high: "Busy" };
export const SCALE_LABELS = { small: "Small", medium: "Medium", large: "Large" };

type PickerProps = { profile: Profile; onChange: (profile: Profile) => void };

function chosen<T>(value: T): Field<T> {
  return { value, origin: "explicit" };
}

// A starred motif is the main shape and the rest are accents; with no star, all are equal.
function withRoles(choices: MotifChoice[]): MotifChoice[] {
  const hasMain = choices.some((c) => c.role === "main");
  return choices.map((c) => (c.role === "main" ? c : hasMain ? { id: c.id, role: "accent" } : { id: c.id }));
}

export function Badge({ origin }: { origin: Origin | "needed" }) {
  const styles = {
    explicit: ["you said", "bg-foreground text-background"],
    suggested: ["suggested", "border border-[#B96446] text-[#B96446]"],
    default: ["default", "bg-black/5 text-foreground/60"],
    needed: ["needed", "bg-[#CF4D64]/10 text-[#A33A4E]"],
  } as const;
  const [label, className] = styles[origin];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${className}`}>{label}</span>;
}

export function Option({ selected, onClick, disabled, className = "", children }: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`${className} rounded-xl border px-3 py-2 text-sm transition ${
        selected ? "border-foreground bg-white shadow-sm" : "border-black/10 bg-white/50 hover:border-black/30"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

// keepOne: the View panel always needs at least one shape to draw.
export function ShapePicker({ profile, onChange, keepOne = false }: PickerProps & { keepOne?: boolean }) {
  const motifs = profile.motifs?.value ?? [];
  const toggleMotif = (id: MotifId) => {
    const selected = motifs.some((m) => m.id === id);
    if (selected && keepOne && motifs.length === 1) return;
    const next = selected ? motifs.filter((m) => m.id !== id) : [...motifs, { id }];
    onChange({
      ...profile,
      motifs: next.length ? chosen(withRoles(next)) : undefined,
      excludedIngredientIds: profile.excludedIngredientIds.filter((x) => x !== id),
    });
  };
  const toggleMain = (id: MotifId) => {
    const isMain = motifs.some((m) => m.id === id && m.role === "main");
    onChange({ ...profile, motifs: chosen(withRoles(motifs.map((m) => (m.id === id && !isMain ? { id, role: "main" } : { id: m.id })))) });
  };

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {MOTIF_IDS.map((id) => {
        const choice = motifs.find((m) => m.id === id);
        return (
          <div key={id} className="relative">
            <Option selected={!!choice} onClick={() => toggleMotif(id)} disabled={!choice && motifs.length >= MAX_MOTIFS} className="w-full">
              <span className="flex flex-col items-center gap-1">
                <MotifIcon id={id} className="h-12 w-12" />
                {MOTIFS[id].label}
                <span className="h-4 text-xs text-foreground/60">{choice?.role ?? ""}</span>
              </span>
            </Option>
            {choice && motifs.length > 1 && (
              <button
                type="button"
                onClick={() => toggleMain(id)}
                aria-label={choice.role === "main" ? `Unstar ${MOTIFS[id].label}` : `Make ${MOTIFS[id].label} the main shape`}
                className={`absolute top-1 right-1 h-7 w-7 rounded-full text-lg leading-none ${choice.role === "main" ? "text-[#D5A24C]" : "text-black/25 hover:text-black/50"}`}
              >
                ★
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PalettePicker({ profile, onChange }: PickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {PALETTE_IDS.map((id) => (
        <Option key={id} selected={profile.paletteId?.value === id} onClick={() => onChange({ ...profile, paletteId: chosen(id) })}>
          <span className="flex flex-col items-start gap-2">
            <span className="flex">
              {PALETTES[id].colors.map((color) => (
                <span key={color} className="-mr-1.5 h-6 w-6 rounded-full border-2 border-white" style={{ background: color }} />
              ))}
            </span>
            {PALETTES[id].label}
          </span>
        </Option>
      ))}
    </div>
  );
}

export function LayoutPicker({ profile, onChange }: PickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {LAYOUT_IDS.map((id) => (
        <Option key={id} selected={profile.layoutId?.value === id} onClick={() => onChange({ ...profile, layoutId: chosen(id) })}>
          {LAYOUTS[id].label}
        </Option>
      ))}
    </div>
  );
}

export function ScalePicker({ profile, onChange }: PickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {MOTIF_SCALES.map((id) => (
        <Option key={id} selected={(profile.motifScale?.value ?? "medium") === id} onClick={() => onChange({ ...profile, motifScale: chosen(id) })}>
          {SCALE_LABELS[id]}
        </Option>
      ))}
    </div>
  );
}

export function DensityPicker({ profile, onChange }: PickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {DENSITIES.map((id) => (
        <Option key={id} selected={(profile.density?.value ?? "medium") === id} onClick={() => onChange({ ...profile, density: chosen(id) })}>
          {DENSITY_LABELS[id]}
        </Option>
      ))}
    </div>
  );
}

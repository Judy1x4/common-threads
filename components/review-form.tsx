"use client";

import type { ReactNode } from "react";
import { LAYOUTS, MOTIFS, PALETTES } from "@/lib/catalogue";
import { missingChoices } from "@/lib/recipe";
import {
  DENSITIES, LAYOUT_IDS, MOTIF_IDS, MOTIF_SCALES, PALETTE_IDS,
  type Field, type MotifChoice, type MotifId, type Origin, type Profile,
} from "@/lib/types";
import { MotifIcon } from "./motif-icon";

const MAX_MOTIFS = 3;
const DENSITY_LABELS = { low: "Spacious", medium: "Balanced", high: "Busy" };
const SCALE_LABELS = { small: "Small", medium: "Medium", large: "Large" };
const TOPIC_LABELS = { scene: "inspiration", shapes: "shapes", colours: "colours", arrangement: "arrangement", detail: "detail" };

function chosen<T>(value: T): Field<T> {
  return { value, origin: "explicit" };
}

// A starred motif is the main shape and the rest are accents; with no star, all are equal.
function withRoles(choices: MotifChoice[]): MotifChoice[] {
  const hasMain = choices.some((c) => c.role === "main");
  return choices.map((c) => (c.role === "main" ? c : hasMain ? { id: c.id, role: "accent" } : { id: c.id }));
}

function Badge({ origin }: { origin: Origin | "needed" }) {
  const styles = {
    explicit: ["you said", "bg-foreground text-background"],
    suggested: ["suggested", "border border-[#B96446] text-[#B96446]"],
    default: ["default", "bg-black/5 text-foreground/60"],
    needed: ["needed", "bg-[#CF4D64]/10 text-[#A33A4E]"],
  } as const;
  const [label, className] = styles[origin];
  return <span className={`rounded-full px-2 py-0.5 text-xs ${className}`}>{label}</span>;
}

function Section({ title, origin, hint, children }: { title: string; origin: Origin | "needed"; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{title}</h3>
        <Badge origin={origin} />
        {hint && <span className="text-sm text-foreground/60">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Option({ selected, onClick, disabled, className = "", children }: {
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

export function ReviewForm({ profile, sampleName, onChange, onCreate }: {
  profile: Profile;
  sampleName?: string;
  onChange: (profile: Profile) => void;
  onCreate: () => void;
}) {
  const motifs = profile.motifs?.value ?? [];
  const missing = missingChoices(profile);
  const set = (patch: Partial<Profile>) => onChange({ ...profile, ...patch });

  const toggleMotif = (id: MotifId) => {
    const next = motifs.some((m) => m.id === id) ? motifs.filter((m) => m.id !== id) : [...motifs, { id }];
    set({
      motifs: next.length ? chosen(withRoles(next)) : undefined,
      excludedIngredientIds: profile.excludedIngredientIds.filter((x) => x !== id),
    });
  };
  const toggleMain = (id: MotifId) => {
    const isMain = motifs.some((m) => m.id === id && m.role === "main");
    set({ motifs: chosen(withRoles(motifs.map((m) => (m.id === id && !isMain ? { id, role: "main" } : { id: m.id })))) });
  };

  return (
    <div className="flex flex-col gap-8 rounded-2xl border border-black/10 bg-white/60 p-5 sm:p-7">
      <header className="flex flex-col gap-1">
        <h2 className="font-serif text-3xl">Check your choices</h2>
        <p className="text-foreground/70">
          {sampleName ? `Sample profile: ${sampleName}. ` : ""}Change anything, then create your pattern.
        </p>
      </header>

      <Section title="Inspiration" origin={profile.scene?.origin ?? "default"} hint="Optional">
        <input
          value={profile.scene?.value ?? ""}
          onChange={(e) => set({ scene: e.target.value ? chosen(e.target.value) : undefined })}
          placeholder="A scene, memory, or feeling"
          className="rounded-xl border border-black/10 bg-white px-3 py-2"
        />
      </Section>

      <Section title="Shapes" origin={profile.motifs?.origin ?? "needed"} hint="Pick up to three; star one to make it the main shape">
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
      </Section>

      <Section title="Colours" origin={profile.paletteId?.origin ?? "needed"}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PALETTE_IDS.map((id) => (
            <Option key={id} selected={profile.paletteId?.value === id} onClick={() => set({ paletteId: chosen(id) })}>
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
      </Section>

      <Section title="Arrangement" origin={profile.layoutId?.origin ?? "needed"}>
        <div className="flex flex-wrap gap-2">
          {LAYOUT_IDS.map((id) => (
            <Option key={id} selected={profile.layoutId?.value === id} onClick={() => set({ layoutId: chosen(id) })}>
              {LAYOUTS[id].label}
            </Option>
          ))}
        </div>
      </Section>

      <div className="grid gap-8 sm:grid-cols-2">
        <Section title="Motif size" origin={profile.motifScale?.origin ?? "default"}>
          <div className="flex flex-wrap gap-2">
            {MOTIF_SCALES.map((id) => (
              <Option key={id} selected={(profile.motifScale?.value ?? "medium") === id} onClick={() => set({ motifScale: chosen(id) })}>
                {SCALE_LABELS[id]}
              </Option>
            ))}
          </div>
        </Section>
        <Section title="Density" origin={profile.density?.origin ?? "default"}>
          <div className="flex flex-wrap gap-2">
            {DENSITIES.map((id) => (
              <Option key={id} selected={(profile.density?.value ?? "medium") === id} onClick={() => set({ density: chosen(id) })}>
                {DENSITY_LABELS[id]}
              </Option>
            ))}
          </div>
        </Section>
      </div>

      <footer className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onCreate}
          disabled={missing.length > 0}
          className="rounded-full bg-foreground px-6 py-3 text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Create pattern
        </button>
        {missing.length > 0 && (
          <span className="text-sm text-foreground/60">Still needed: {missing.map((t) => TOPIC_LABELS[t]).join(", ")}</span>
        )}
      </footer>
    </div>
  );
}

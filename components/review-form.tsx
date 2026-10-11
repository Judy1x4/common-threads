"use client";

import type { ReactNode } from "react";
import { missingChoices } from "@/lib/recipe";
import type { Origin, Profile } from "@/lib/types";
import { Badge, DensityPicker, LayoutPicker, PalettePicker, ScalePicker, ShapePicker } from "./choices";

const TOPIC_LABELS = { scene: "inspiration", shapes: "shapes", colours: "colours", arrangement: "arrangement", detail: "detail" };

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

// The choices form: "Change choices", the sample profiles, and the path without AI.
export function ReviewForm({ profile, sampleName, onChange, onCreate }: {
  profile: Profile;
  sampleName?: string;
  onChange: (profile: Profile) => void;
  onCreate: () => void;
}) {
  const missing = missingChoices(profile);
  const picker = { profile, onChange };

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
          onChange={(e) => onChange({ ...profile, scene: e.target.value ? { value: e.target.value, origin: "explicit" } : undefined })}
          placeholder="A scene, memory, or feeling"
          className="rounded-xl border border-black/10 bg-white px-3 py-2"
        />
      </Section>

      <Section title="Shapes" origin={profile.motifs?.origin ?? "needed"} hint="Pick up to three; star one to make it the main shape">
        <ShapePicker {...picker} />
      </Section>

      <Section title="Colours" origin={profile.paletteId?.origin ?? "needed"}>
        <PalettePicker {...picker} />
      </Section>

      <Section title="Arrangement" origin={profile.layoutId?.origin ?? "needed"}>
        <LayoutPicker {...picker} />
      </Section>

      <div className="grid gap-8 sm:grid-cols-2">
        <Section title="Motif size" origin={profile.motifScale?.origin ?? "default"}>
          <ScalePicker {...picker} />
        </Section>
        <Section title="Density" origin={profile.density?.origin ?? "default"}>
          <DensityPicker {...picker} />
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

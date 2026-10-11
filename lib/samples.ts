// Contrasting sample profiles for /lab and the "Try sample" demo. Together they
// cover every motif, palette, layout, density, and size.
import type { Field, MotifChoice, Profile } from "./types";

export type Sample = { id: string; name: string; seed: number; profile: Profile };

function said<T>(value: T): Field<T> {
  return { value, origin: "explicit" };
}

function profile(scene: string, motifs: MotifChoice[], rest: Omit<Profile, "scene" | "motifs" | "excludedIngredientIds">): Profile {
  return { scene: said(scene), motifs: said(motifs), excludedIngredientIds: [], ...rest };
}

export const SAMPLES: Sample[] = [
  {
    id: "quiet-beach",
    name: "Quiet beach",
    seed: 42,
    profile: profile("a quiet beach", [{ id: "wave", role: "main" }, { id: "circle", role: "accent" }], {
      paletteId: said("cool"), layoutId: said("scattered"), density: said("low"), motifScale: said("small"),
    }),
  },
  {
    id: "autumn-garden",
    name: "Autumn garden",
    seed: 7,
    profile: profile("my grandmother's garden in autumn", [{ id: "leaf", role: "main" }, { id: "dot", role: "accent" }], {
      paletteId: said("warm"), layoutId: said("scattered"), density: said("medium"), motifScale: said("medium"),
    }),
  },
  {
    id: "market-awnings",
    name: "Market awnings",
    seed: 3,
    profile: profile("a busy night market", [{ id: "stripe" }, { id: "arch" }], {
      paletteId: said("vivid"), layoutId: said("grid"), density: said("high"), motifScale: said("small"),
    }),
  },
  {
    id: "forest-floor",
    name: "Forest floor",
    seed: 11,
    profile: profile("walking in a rainforest", [{ id: "leaf", role: "main" }, { id: "circle", role: "accent" }, { id: "dot", role: "accent" }], {
      paletteId: said("green"), layoutId: said("scattered"), density: said("high"), motifScale: said("medium"),
    }),
  },
  {
    id: "old-doorways",
    name: "Old doorways",
    seed: 5,
    profile: profile("shophouse doorways", [{ id: "arch", role: "main" }, { id: "dot", role: "accent" }], {
      paletteId: said("warm"), layoutId: said("grid"), density: said("medium"), motifScale: said("large"),
    }),
  },
  {
    id: "river-rain",
    name: "Rain on the river",
    seed: 19,
    profile: profile("rain on the river", [{ id: "wave" }, { id: "dot" }], {
      paletteId: said("cool"), layoutId: said("grid"), density: said("high"), motifScale: said("small"),
    }),
  },
  {
    id: "bold-rings",
    name: "Bold rings",
    seed: 23,
    profile: profile("ripples in a pond", [{ id: "circle" }], {
      paletteId: said("vivid"), layoutId: said("grid"), density: said("low"), motifScale: said("large"),
    }),
  },
  {
    id: "tidal-lines",
    name: "Tidal lines",
    seed: 31,
    profile: profile("sand lines at low tide", [{ id: "stripe", role: "main" }, { id: "wave", role: "accent" }], {
      paletteId: said("green"), layoutId: said("scattered"), density: said("medium"), motifScale: said("small"),
    }),
  },
];

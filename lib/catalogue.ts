// The artist's ingredient library and design constants
// (docs/IMPLEMENTATION_PLAN.md §4 and §5A).
import { MOTIF_PATHS } from "./motif-paths";
import type { Density, LayoutId, MotifId, MotifScale, PaletteId } from "./types";

// Bump when drawings, palettes, or layout rules change, so a saved recipe and
// seed still reproduce the tile they were made with.
export const ARTWORK_VERSION = 1;

export const TILE_SIZE = 512;
export const MOTIF_BOX = 100; // motif paths are drawn in a 100 × 100 viewBox

export type Motif = {
  id: MotifId;
  label: string;
  tags: string[]; // help the AI and keyword fallback suggest this motif
  rotations: number[] | "any"; // degrees the artist allows
  path: string;
};

export const MOTIFS: Record<MotifId, Motif> = {
  wave: { id: "wave", label: "Waves", tags: ["water", "flowing", "sea", "beach", "river"], rotations: [0, 180], path: MOTIF_PATHS.wave },
  circle: { id: "circle", label: "Circles", tags: ["round", "simple", "ring", "moon", "sun"], rotations: "any", path: MOTIF_PATHS.circle },
  dot: { id: "dot", label: "Dots", tags: ["small", "accent", "spots", "rain", "pebbles"], rotations: "any", path: MOTIF_PATHS.dot },
  stripe: { id: "stripe", label: "Stripes", tags: ["linear", "rhythmic", "lines"], rotations: [0, 90], path: MOTIF_PATHS.stripe },
  arch: { id: "arch", label: "Arches", tags: ["curved", "structured", "doorway", "rainbow", "bridge"], rotations: [0, 180], path: MOTIF_PATHS.arch },
  leaf: { id: "leaf", label: "Leaves", tags: ["plant", "organic", "nature", "garden", "forest"], rotations: [0, 180], path: MOTIF_PATHS.leaf },
};

// Inks are ordered by contrast against the background, so colour rank 1 is
// always the strongest. Render plans store ranks, not hex values.
export type Palette = {
  label: string;
  description: string; // colour names for the extraction prompt
  colors: [background: string, ink1: string, ink2: string, ink3: string];
};

export const PALETTES: Record<PaletteId, Palette> = {
  warm: { label: "Warm", description: "cream, brown, terracotta, ochre", colors: ["#F2E5CE", "#42372E", "#B96446", "#D5A24C"] },
  cool: { label: "Cool", description: "cream, navy, blue-grey, pale grey", colors: ["#F6F0E2", "#294F6D", "#769CAF", "#BFC9C7"] },
  green: { label: "Green", description: "cream, forest, clay, sage", colors: ["#F3EADB", "#426451", "#C78562", "#93AA8D"] },
  vivid: { label: "Vivid", description: "cream, teal, raspberry, mustard", colors: ["#FFF2D8", "#247D8C", "#CF4D64", "#E8B13E"] },
};

export const LAYOUTS: Record<LayoutId, { label: string }> = {
  grid: { label: "Regular" },
  scattered: { label: "Scattered" },
};

// Logical motif placements per tile; the grid layout uses 2 × 2, 3 × 3, or 4 × 4 cells.
export const PLACEMENTS: Record<Density, number> = { low: 4, medium: 9, high: 16 };

// Fixed motif sizes in tile pixels, independent of density.
export const MOTIF_SIZES: Record<MotifScale, number> = { small: 55, medium: 80, large: 110 };

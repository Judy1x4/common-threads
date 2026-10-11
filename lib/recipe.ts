// Profile → recipe (docs/IMPLEMENTATION_PLAN.md §5A).
import { ARTWORK_VERSION, LAYOUTS, MOTIFS, PALETTES, PLACEMENTS } from "./catalogue";
import type { Field, Ingredient, MotifChoice, Profile, Reason, Recipe, Topic } from "./types";

const WEIGHTS = { main: 3, accent: 1, equal: 1 };
const MAX_MOTIFS = 3;

function usableMotifs(profile: Profile): MotifChoice[] {
  return (profile.motifs?.value ?? [])
    .filter((m) => !profile.excludedIngredientIds.includes(m.id))
    .slice(0, MAX_MOTIFS);
}

// Topics that still need an answer before a recipe can be built.
export function missingChoices(profile: Profile): Topic[] {
  const missing: Topic[] = [];
  if (!usableMotifs(profile).length) missing.push("shapes");
  if (!profile.paletteId) missing.push("colours");
  if (!profile.layoutId) missing.push("arrangement");
  return missing;
}

// Split the placement budget by weight, rounding with largest remainders.
// Every chosen motif appears at least once.
export function allocateCounts(choices: MotifChoice[], total: number): Ingredient[] {
  const weights = choices.map((c) => WEIGHTS[c.role ?? "equal"]);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const quotas = weights.map((w) => (total * w) / weightSum);
  const counts = quotas.map(Math.floor);

  const leftover = total - counts.reduce((a, b) => a + b, 0);
  const byRemainder = quotas.map((_, i) => i).sort((a, b) => quotas[b] - counts[b] - (quotas[a] - counts[a]));
  byRemainder.slice(0, leftover).forEach((i) => counts[i]++);

  counts.forEach((count, i) => {
    if (count === 0) {
      counts[counts.indexOf(Math.max(...counts))]--;
      counts[i]++;
    }
  });

  return choices.map((c, i) => ({ id: c.id, role: c.role, weight: weights[i], count: counts[i] }));
}

export function profileToRecipe(profile: Profile, seed: number): Recipe {
  const motifs = usableMotifs(profile);
  const { paletteId, layoutId } = profile;
  if (!motifs.length || !paletteId || !layoutId) {
    throw new Error(`Profile is missing: ${missingChoices(profile).join(", ")}`);
  }
  const settings = {
    layoutId: layoutId.value,
    paletteId: paletteId.value,
    density: profile.density?.value ?? "medium",
    motifScale: profile.motifScale?.value ?? "medium",
  } satisfies Settings;

  return {
    ingredients: allocateCounts(motifs, PLACEMENTS[settings.density]),
    ...settings,
    excludedIngredientIds: profile.excludedIngredientIds,
    seed,
    reasons: recipeReasons(profile, motifs, settings),
    artworkVersion: ARTWORK_VERSION,
  };
}

type Settings = Pick<Recipe, "layoutId" | "paletteId" | "density" | "motifScale">;

const ORIGIN_TEXT = {
  explicit: "you asked for this",
  suggested: "suggested from your answers",
  default: "a default you can change",
};

function reason(text: string, field: Field<unknown> | undefined): Reason {
  return { text: `${text} (${ORIGIN_TEXT[field?.origin ?? "default"]})`, messageId: field?.messageId };
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function listLabels(choices: MotifChoice[]): string {
  const labels = choices.map((c) => MOTIFS[c.id].label.toLowerCase());
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}` : labels[0];
}

function recipeReasons(profile: Profile, motifs: MotifChoice[], settings: Settings): Reason[] {
  const main = motifs.filter((m) => m.role === "main");
  const others = motifs.filter((m) => m.role !== "main");
  const shapes = main.length
    ? `${listLabels(main)} as the main shape${others.length ? `, with ${listLabels(others)} as accents` : ""}`
    : `${listLabels(motifs)} in equal measure`;
  const palette = PALETTES[settings.paletteId];

  const reasons = [
    reason(capitalise(shapes), profile.motifs),
    reason(`${palette.label} palette: ${palette.description}`, profile.paletteId),
    reason(`${LAYOUTS[settings.layoutId].label} arrangement`, profile.layoutId),
    reason(`${capitalise(settings.density)} density`, profile.density),
    reason(`${capitalise(settings.motifScale)} motifs`, profile.motifScale),
  ];
  if (profile.scene) reasons.unshift(reason(`Inspired by “${profile.scene.value}”`, profile.scene));
  return reasons;
}

// Create pattern (docs/CONVERSATION_PLAN.md §4–5): fill missing choices with the
// model's suggestions, build the design, and add its card to the chat.
import { plainWords, recentHistory } from "./interview";
import { describeDesign, missingChoices, patternTitle, profileToRecipe } from "./recipe";
import { buildRenderPlan } from "./render";
import type { FinishRequest, FinishTurn } from "./schemas";
import type { Design, Field, MotifChoice, Profile, Session, Stated, Topic } from "./types";

export const CREATE_MESSAGE = "Create pattern";

// The real steps behind Create; the first waits on the model.
export const CREATE_STAGES = ["Reading your story", "Choosing motifs", "Mixing colours", "Composing the tile", "Naming it"];

// Required choices still missing, plus "detail" when neither size nor density is set.
export function topicsToSuggest(profile: Profile): Topic[] {
  const missing = missingChoices(profile);
  if (!profile.density && !profile.motifScale) missing.push("detail");
  return missing;
}

export function finishRequest(session: Session): FinishRequest {
  return { mode: "finish", messages: recentHistory(session), profile: session.profile, missing: topicsToSuggest(session.profile) };
}

// The model's suggestions only fill empty fields, and are always marked "suggested".
export function applyFinish(profile: Profile, e: FinishTurn["extraction"], messageId: string): Profile {
  const fill = <T,>(current: Field<T> | undefined, incoming: Stated<T> | null): Field<T> | undefined =>
    current ?? (incoming ? { value: incoming.value, origin: "suggested", messageId } : undefined);
  const hasMotifs = missingChoices(profile).every((t) => t !== "shapes");
  const motifs: MotifChoice[] = e.motifs
    .filter((m) => !profile.excludedIngredientIds.includes(m.id))
    .slice(0, 3)
    .map((m) => (m.role === "equal" ? { id: m.id } : { id: m.id, role: m.role }));
  return {
    ...profile,
    motifs: hasMotifs || !motifs.length ? profile.motifs : { value: motifs, origin: "suggested", messageId },
    paletteId: fill(profile.paletteId, e.paletteId),
    layoutId: fill(profile.layoutId, e.layoutId),
    density: fill(profile.density, e.density),
    motifScale: fill(profile.motifScale, e.motifScale),
  };
}

// A complete profile and a seed make a design; the model's name and description
// are used when present, otherwise code writes them.
export function buildDesign(profile: Profile, seed: number, words?: { name: string; description: string }): Design {
  const recipe = profileToRecipe(profile, seed);
  return {
    name: words?.name.trim() || patternTitle(profile, recipe),
    description: (words && plainWords(words.description.trim())) || describeDesign(recipe),
    recipe,
    plan: buildRenderPlan(recipe),
  };
}

// A change in the View panel: same seed, name, and description.
export function rebuildDesign(design: Design, profile: Profile): Design {
  return { ...buildDesign(profile, design.recipe.seed, design), name: design.name, description: design.description };
}

export function addDesign(session: Session, profile: Profile, design: Design): Session {
  const card = { id: `m${session.messages.length}`, role: "assistant" as const, text: `Created “${design.name}”: ${design.description}`, design };
  return {
    ...session,
    profile,
    design,
    previousDesign: session.design,
    messages: [...session.messages, card],
    interview: { ...session.interview, phase: "INTERVIEW" },
  };
}

// Replace the latest design and its card's snapshot (View panel changes).
export function replaceLatestDesign(session: Session, profile: Profile, design: Design): Session {
  const index = session.messages.findLastIndex((m) => m.design);
  const messages = session.messages.map((m, i) => (i === index ? { ...m, design } : m));
  return { ...session, profile, design, previousDesign: session.design, messages };
}

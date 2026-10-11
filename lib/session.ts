// The saved session: one chat, its profile, and its design, kept in this
// browser's localStorage (docs/IMPLEMENTATION_PLAN.md §3).
import { addDesign } from "./design";
import { openingMessage } from "./interview";
import { describeDesign, patternTitle } from "./recipe";
import type { Recipe, RenderPlan, Session } from "./types";

const STORAGE_KEY = "common-threads:session:v1";

export function emptySession(): Session {
  return {
    messages: [openingMessage()],
    profile: { excludedIngredientIds: [] },
    interview: { phase: "INTERVIEW", questionCount: 1, askedTopics: ["scene"], skippedTopics: [] },
  };
}

export function loadSession(): Session | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Session | null;
    if (!saved?.profile || !saved.interview || !Array.isArray(saved.messages)) return null;
    return upgrade(saved);
  } catch {
    return null; // blocked storage or corrupt data: start fresh
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage full or blocked: the session still works in memory.
  }
}

// Sessions saved by earlier versions: add the opening question, and turn the old
// result page (currentRecipe + renderPlan) into a result card in the chat.
type OldSession = Session & { currentRecipe?: Recipe; renderPlan?: RenderPlan };

function upgrade(saved: Session): Session {
  const old = saved as OldSession;
  let session: Session = saved;
  if (!session.messages.length) {
    session = { ...session, messages: [openingMessage()], interview: { ...session.interview, askedTopics: ["scene"], questionCount: 1 } };
  }
  if ((old.interview.phase as string) === "RESULT") session = { ...session, interview: { ...session.interview, phase: "INTERVIEW" } };
  if (old.currentRecipe && old.renderPlan && !session.design) {
    const recipe = old.currentRecipe;
    const design = { name: patternTitle(session.profile, recipe), description: describeDesign(recipe), recipe, plan: old.renderPlan };
    session = addDesign(session, session.profile, design);
  }
  const { currentRecipe: _recipe, renderPlan: _plan, ...rest } = session as OldSession;
  void _recipe;
  void _plan;
  return rest;
}

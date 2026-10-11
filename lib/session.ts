// The saved session: one chat, its profile, and its design, kept in this
// browser's localStorage (docs/IMPLEMENTATION_PLAN.md §3).
import type { Session } from "./types";

const STORAGE_KEY = "common-threads:session:v1";

export function emptySession(): Session {
  return {
    messages: [],
    profile: { excludedIngredientIds: [] },
    interview: { phase: "INTERVIEW", questionCount: 0, askedTopics: [], skippedTopics: [] },
  };
}

export function loadSession(): Session | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Session | null;
    return saved?.profile && saved.interview && Array.isArray(saved.messages) ? saved : null;
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

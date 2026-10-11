// The saved session: one chat, its profile, and its design, kept in this
// browser's localStorage (docs/IMPLEMENTATION_PLAN.md §3).
import { openingMessage } from "./interview";
import type { Session } from "./types";

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
    // Sessions saved before the chat existed start without the opening question.
    if (!saved.messages.length) {
      return { ...saved, messages: [openingMessage()], interview: { ...saved.interview, askedTopics: ["scene"], questionCount: 1 } };
    }
    return saved;
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

// React access to the saved session. useSyncExternalStore renders the empty
// server snapshot during prerender and hydration, then the saved session.
import { useCallback, useSyncExternalStore } from "react";
import { emptySession, loadSession, saveSession } from "./session";
import type { Session } from "./types";

const serverSession = emptySession();
const listeners = new Set<() => void>();
let current: Session | null = null;

function snapshot(): Session {
  current ??= loadSession() ?? emptySession();
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSession(): [Session, (change: (session: Session) => Session) => void] {
  const session = useSyncExternalStore(subscribe, snapshot, () => serverSession);
  const update = useCallback((change: (session: Session) => Session) => {
    current = change(snapshot());
    saveSession(current);
    listeners.forEach((listener) => listener());
  }, []);
  return [session, update];
}

const subscribeNever = () => () => {};

// False while prerendering and hydrating, true once the saved session is readable.
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}

// Browser side of /api/chat: send the session state and get back a validated
// turn, or a short reason the chat falls back to code.
import type { z } from "zod";
import { finishRequest } from "./design";
import { interviewRequest } from "./interview";
import { ChatTurnSchema, FinishTurnSchema, type ChatTurn, type FinishTurn } from "./schemas";
import type { Session } from "./types";

export class ChatUnavailable extends Error {}

const CODE_KEY = "common-threads:access-code";

// A shared link like https://…/?code=XXXX stores the demo access code (see
// DEMO_ACCESS_CODE in docs/HOSTING_PLAN.md) for later visits.
function accessCode(): string {
  try {
    const fromLink = new URLSearchParams(window.location.search).get("code");
    if (fromLink) localStorage.setItem(CODE_KEY, fromLink);
    return fromLink ?? localStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

export const requestTurn = (session: Session): Promise<ChatTurn> => post(interviewRequest(session), ChatTurnSchema);
export const requestFinish = (session: Session): Promise<FinishTurn> => post(finishRequest(session), FinishTurnSchema);

async function post<S extends z.ZodType>(body: unknown, schema: S): Promise<z.infer<S>> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Access-Code": accessCode() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(17_000), // the server gives up at 15 s
    });
  } catch (error) {
    throw new ChatUnavailable(error instanceof Error && error.name === "TimeoutError" ? "timed out" : "no connection");
  }
  const reply: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const reason = reply && typeof reply === "object" && "error" in reply ? String(reply.error) : `error ${response.status}`;
    throw new ChatUnavailable(reason);
  }
  const turn = schema.safeParse(reply);
  if (!turn.success) throw new ChatUnavailable("unexpected reply");
  return turn.data;
}

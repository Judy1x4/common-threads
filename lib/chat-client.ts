// Browser side of /api/chat: send the interview state and get back a validated
// turn, or a short reason the chat falls back to keyword matching.
import { interviewRequest } from "./interview";
import { ChatTurnSchema, type ChatTurn } from "./schemas";
import type { Session } from "./types";

export class ChatUnavailable extends Error {}

export async function requestTurn(session: Session): Promise<ChatTurn> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(interviewRequest(session)),
      signal: AbortSignal.timeout(17_000), // the server gives up at 15 s
    });
  } catch (error) {
    throw new ChatUnavailable(error instanceof Error && error.name === "TimeoutError" ? "timed out" : "no connection");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const reason = body && typeof body === "object" && "error" in body ? String(body.error) : `error ${response.status}`;
    throw new ChatUnavailable(reason);
  }
  const turn = ChatTurnSchema.safeParse(body);
  if (!turn.success) throw new ChatUnavailable("unexpected reply");
  return turn.data;
}

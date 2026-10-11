import Anthropic from "@anthropic-ai/sdk";
import { finishTurn, interviewTurn, ModelError } from "@/lib/model";
import { ChatRequestSchema } from "@/lib/schemas";

// One model call per user message ("interview") and one at Create ("finish").
// The browser falls back on any non-200 response, so errors only need a short reason.
export async function POST(request: Request) {
  const parsed = ChatRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  try {
    const body = parsed.data;
    return Response.json(body.mode === "finish" ? await finishTurn(body) : await interviewTurn(body));
  } catch (error) {
    const reason =
      error instanceof Anthropic.AuthenticationError ? "API key rejected"
      : error instanceof Anthropic.RateLimitError ? "rate limited"
      : error instanceof Anthropic.APIUserAbortError || error instanceof Anthropic.APIConnectionTimeoutError ? "timed out"
      : error instanceof Anthropic.APIError ? `API error ${error.status ?? ""}`.trim()
      : error instanceof ModelError ? error.message
      : "model unavailable";
    console.error("[api/chat]", reason, error instanceof Error ? error.message : error);
    return Response.json({ error: reason }, { status: 502 });
  }
}

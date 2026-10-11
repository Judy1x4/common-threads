import Anthropic from "@anthropic-ai/sdk";
import { interviewTurn, ModelError } from "@/lib/model";
import { InterviewRequestSchema } from "@/lib/schemas";

// One model call per user message. The browser falls back to keyword matching
// on any non-200 response, so errors only need a short reason.
export async function POST(request: Request) {
  const parsed = InterviewRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  try {
    return Response.json(await interviewTurn(parsed.data));
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

// Server-only: the Claude call behind /api/chat (docs/CONVERSATION_PLAN.md §3–4).
// Imported by the route handler and scripts/test-chat.ts; never by the browser.
import dns from "node:dns";
import net from "node:net";
import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { FINISH_SYSTEM, finishState, INTERVIEW_SYSTEM, interviewState } from "./prompt";
import { ChatTurnSchema, FinishTurnSchema, type ChatTurn, type FinishRequest, type FinishTurn, type InterviewRequest } from "./schemas";
import type { Profile } from "./types";

const TIME_LIMIT_MS = 15_000; // the whole call, retries included; then the browser falls back

// On networks without a working IPv6 route (common under WSL), Node gives each
// address only 250 ms before trying the next, so a slow IPv4 handshake loses to
// a dead IPv6 one and most new connections fail with ETIMEDOUT. Prefer IPv4
// and give each address up to 2 s.
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamilyAttemptTimeout(2000);

let client: Anthropic | undefined;
const getClient = () => (client ??= new Anthropic({ maxRetries: 1 }));
export const modelName = () => process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

export class ModelError extends Error {}

// The model's state note goes in a mid-conversation system message, which keeps
// the cached prefix stable. If the model rejects that role, retry with the note
// as a tagged block in the latest user message.
async function parseTurn<S extends z.ZodType>(
  system: string,
  schema: S,
  history: BetaMessageParam[],
  state: string,
  stateInSystemRole: boolean,
): Promise<z.infer<S>> {
  const model = modelName();
  const messages: BetaMessageParam[] = stateInSystemRole
    ? [...history, { role: "system", content: state }]
    : [
        ...history.slice(0, -1),
        {
          role: "user",
          content: [
            { type: "text", text: String(history.at(-1)?.content ?? "") },
            { type: "text", text: `<state>\n${state}\n</state>` },
          ],
        },
      ];

  const response = await getClient().beta.messages.parse(
    {
      model,
      max_tokens: 16000,
      // Server-side fallback reruns a declined request on another model. Haiku has none.
      ...(model.includes("haiku") ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
      // CHAT_THINKING=off lets Haiku skip thinking: about twice as fast, but it
      // breaks the reply rules more often. Opus 5.5 always thinks.
      ...(model.includes("haiku") && process.env.CHAT_THINKING === "off" ? { thinking: { type: "disabled" as const } } : {}),
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages,
    },
    { signal: AbortSignal.timeout(TIME_LIMIT_MS) },
  );

  if (response.stop_reason === "refusal") throw new ModelError(`declined (${response.stop_details?.category ?? "no category"})`);
  if (!response.parsed_output) throw new ModelError(`no structured output (stop reason: ${response.stop_reason})`);
  return response.parsed_output as z.infer<S>;
}

let systemRoleSupported = true;
export const usesSystemRole = () => systemRoleSupported; // for scripts/test-chat.ts

async function call<S extends z.ZodType>(system: string, schema: S, request: { messages: InterviewRequest["messages"] }, state: string) {
  const history: BetaMessageParam[] = request.messages.map((m) => ({ role: m.role, content: m.text }));
  try {
    return await parseTurn(system, schema, history, state, systemRoleSupported);
  } catch (error) {
    if (systemRoleSupported && error instanceof Anthropic.BadRequestError && /role/i.test(error.message)) {
      systemRoleSupported = false;
      return parseTurn(system, schema, history, state, false);
    }
    throw error;
  }
}

// Every user message: read the answer, write the reply and next question.
export function interviewTurn(request: InterviewRequest): Promise<ChatTurn> {
  return call(INTERVIEW_SYSTEM, ChatTurnSchema, request, interviewState(request.profile as Profile, request.openTopics, request.questionCount));
}

// Create pattern: suggest the missing choices, and name and describe the pattern.
export function finishTurn(request: FinishRequest): Promise<FinishTurn> {
  return call(FINISH_SYSTEM, FinishTurnSchema, request, finishState(request.profile as Profile, request.missing));
}

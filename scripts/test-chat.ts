// Plays conversations against the real model, through the same request builder
// and turn logic as the browser, to tune the prompt (docs/CONVERSATION_PLAN.md §7).
// Run: npm run test:chat            (uses ANTHROPIC_API_KEY and ANTHROPIC_MODEL from .env.local)
import { addUserMessage, applyModelTurn, interviewRequest, nextStep } from "../lib/interview";
import { interviewTurn, modelName, usesSystemRole } from "../lib/model";
import { emptySession } from "../lib/session";
import type { Session } from "../lib/types";

const TECHNICAL = /\b(motifs?|palettes?|density|layouts?|grid)\b/i;
let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${ok || detail === undefined ? "" : `: ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
}

const timings: number[] = [];
async function say(session: Session, text: string): Promise<Session> {
  const [sent, id] = addUserMessage(session, text);
  const started = Date.now();
  const turn = await interviewTurn(interviewRequest(sent));
  timings.push(Date.now() - started);
  const next = applyModelTurn(sent, turn, id);
  const reply = next.messages.at(-1)!;
  const kept = reply.text === turn.reply;
  console.log(`  You: ${text}\n  Bot: ${reply.text}${kept ? "" : `  [template; model asked ${turn.askedTopic}]`}`);
  console.log(`       → asked ${reply.topic ?? "nothing (ready)"} · suggestions: ${(reply.suggestions ?? []).join(" | ") || "none"} · ${timings.at(-1)} ms`);
  if (kept) {
    const words = reply.text.split(/\s+/).length;
    const questions = (reply.text.match(/\?/g) ?? []).length;
    if (words > 45 || questions > 1 || TECHNICAL.test(reply.text)) {
      check("reply: ≤ 45 words, one question, everyday words", false, { words, questions, technical: reply.text.match(TECHNICAL)?.[0] });
    }
  }
  return next;
}

const fields = (s: Session) =>
  Object.entries(s.profile)
    .filter(([, v]) => v && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => (Array.isArray(v) ? `${k}: ${v.join(",")}` : `${k}: ${JSON.stringify((v as { value: unknown }).value)} (${(v as { origin: string }).origin})`))
    .join(" · ");

async function main() {
  console.log(`Model: ${modelName()}`);

  console.log("\n1. The plan's example conversation");
  let s = emptySession();
  for (const text of ["A quiet beach where I used to walk with my dad", "Long slow waves, and a few round pebbles", "Pale blue and sand", "Scattered"]) {
    s = await say(s, text);
  }
  console.log(`  Profile: ${fields(s)}`);
  check("ready to create after four answers", nextStep(s).kind === "ready", s.interview);
  check("waves lead, pebbles as circle or dot accents", s.profile.motifs?.value.find((m) => m.id === "wave")?.role === "main" && s.profile.motifs.value.some((m) => m.id === "circle" || m.id === "dot"), s.profile.motifs);
  check("pale blue → cool", s.profile.paletteId?.value === "cool", s.profile.paletteId);

  console.log("\n2. One answer, several fields; then a correction");
  s = await say(emptySession(), "A quiet beach. Mostly small waves, a few circles. Blue and cream.");
  console.log(`  Profile: ${fields(s)}`);
  check("fills scene, shapes, colours, and size", !!(s.profile.scene && s.profile.motifs && s.profile.paletteId && s.profile.motifScale), s.profile);
  s = await say(s, "Actually, make it green.");
  check("“actually, green” replaces the palette", s.profile.paletteId?.value === "green" && s.profile.paletteId.origin === "explicit", s.profile.paletteId);

  console.log("\n3. Skipping, and an unsupported shape");
  s = await say(emptySession(), "Hmm, I'd rather skip that one");
  check("the scene is skipped", s.interview.skippedTopics.includes("scene"), s.interview);
  s = await say(s, "Flowers and stars, please");
  check("the scene stays skipped", s.interview.skippedTopics.includes("scene") && s.messages.at(-1)!.topic !== "scene");
  check("the reply names a supported alternative", /leaves|leaf|dots?|circles?/i.test(s.messages.at(-1)!.text), s.messages.at(-1)!.text);

  console.log(`\nState note sent as: ${usesSystemRole() ? "mid-conversation system message" : "<state> block in the user message (system role unsupported)"}`);
  console.log(`Time per turn: median ${timings.sort((a, b) => a - b)[Math.floor(timings.length / 2)]} ms, max ${Math.max(...timings)} ms`);
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error("FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});

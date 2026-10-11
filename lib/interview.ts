// The guided conversation (docs/CONVERSATION_PLAN.md §3; IMPLEMENTATION_PLAN.md
// §2–3). The model writes each reply and reads the answer; this code merges the
// answer, checks the model's next topic, and falls back to templates and keyword
// matching when the model is unavailable.
import { LAYOUTS, MOTIFS, PALETTES } from "./catalogue";
import type { ChatTurn, InterviewRequest } from "./schemas";
import type {
  Density, Extraction, Field, Interview, LayoutId, Message, MotifChoice, MotifId, MotifScale, PaletteId, Profile, Session,
  Stated, Topic,
} from "./types";
import { MOTIF_IDS, TOPICS } from "./types";

const MAX_MOTIFS = 3;
const MAX_QUESTIONS = 6;

export const QUESTIONS: Record<Topic, string> = {
  scene: "What scene, memory, or feeling should the pattern reflect?",
  shapes: "Which shapes would you like: waves, circles, leaves, or something else?",
  colours: "What colours would you like?",
  arrangement: "Regularly arranged or scattered?",
  detail: "Small and spacious, or large and busy?",
};

export const OPENING_QUESTION = "Think of a place or moment you'd like to carry with you. What do you see there?";
const OPENING_SUGGESTIONS = ["A quiet beach at dawn", "My grandmother's garden in autumn", "A busy night market"];
const READY_MESSAGE = "I have everything I need. Create your pattern whenever you're ready.";

export function emptyExtraction(): Extraction {
  return {
    scene: null, motifs: [], excludedIngredientIds: [], paletteId: null, layoutId: null, density: null,
    motifScale: null, skippedTopics: [], unsupportedShapes: [], acknowledgement: "",
  };
}

export function openingMessage(): Message {
  return { id: "m0", role: "assistant", text: OPENING_QUESTION, topic: "scene", suggestions: OPENING_SUGGESTIONS };
}

// ---------------------------------------------------------------------------
// Merge: explicit > suggested > default; among explicit values the newest wins.

function mergeField<T>(current: Field<T> | undefined, incoming: Stated<T> | null, messageId: string): Field<T> | undefined {
  if (!incoming) return current;
  if (incoming.origin === "suggested" && current?.origin === "explicit") return current;
  return { value: incoming.value, origin: incoming.origin, messageId };
}

// A main motif makes the others accents; with no main, all are equal.
function withRoles(choices: MotifChoice[]): MotifChoice[] {
  const hasMain = choices.some((c) => c.role === "main");
  return choices.map((c) => (c.role === "main" ? c : hasMain ? { id: c.id, role: "accent" } : { id: c.id }));
}

function mergeMotifs(profile: Profile, e: Extraction, excluded: MotifId[], messageId: string): Field<MotifChoice[]> | undefined {
  const current = profile.motifs;
  const toChoice = (m: Extraction["motifs"][number]): MotifChoice => (m.role === "equal" ? { id: m.id } : { id: m.id, role: m.role });
  const explicit = e.motifs.filter((m) => m.origin === "explicit").map(toChoice);
  const suggested = e.motifs.filter((m) => m.origin === "suggested").map(toChoice);

  let next: MotifChoice[] | undefined;
  let origin: "explicit" | "suggested" = "explicit";
  if (explicit.length) {
    // Named shapes join earlier explicit ones; the newest win when over the limit.
    const keep = current?.origin === "explicit" ? current.value.filter((c) => !explicit.some((x) => x.id === c.id)) : [];
    const newMain = explicit.some((c) => c.role === "main");
    next = [...keep.map((c) => (newMain && c.role === "main" ? { id: c.id } : c)), ...explicit].slice(-MAX_MOTIFS);
  } else if (suggested.length && current?.origin !== "explicit") {
    next = suggested.slice(0, MAX_MOTIFS);
    origin = "suggested";
  } else {
    next = current?.value;
    origin = current?.origin === "suggested" ? "suggested" : "explicit";
  }

  const remaining = (next ?? []).filter((c) => !excluded.includes(c.id));
  if (!remaining.length) return undefined;
  if (current && next === current.value && remaining.length === current.value.length) return current;
  return { value: withRoles(remaining), origin, messageId };
}

export function mergeProfile(profile: Profile, e: Extraction, messageId: string): Profile {
  const chosen = e.motifs.filter((m) => m.origin === "explicit").map((m) => m.id);
  const excluded = [...new Set([...profile.excludedIngredientIds.filter((id) => !chosen.includes(id)), ...e.excludedIngredientIds])];
  return {
    scene: e.scene ? { value: e.scene, origin: "explicit", messageId } : profile.scene,
    motifs: mergeMotifs(profile, e, excluded, messageId),
    excludedIngredientIds: excluded,
    paletteId: mergeField(profile.paletteId, e.paletteId, messageId),
    layoutId: mergeField(profile.layoutId, e.layoutId, messageId),
    density: mergeField(profile.density, e.density, messageId),
    motifScale: mergeField(profile.motifScale, e.motifScale, messageId),
  };
}

// ---------------------------------------------------------------------------
// Choose: ask each topic at most once, in order, until the choices are complete.

export function answeredTopics(profile: Profile): Topic[] {
  const answered: Record<Topic, boolean> = {
    scene: !!profile.scene,
    shapes: !!profile.motifs?.value.length,
    colours: !!profile.paletteId,
    arrangement: !!profile.layoutId,
    detail: !!(profile.density || profile.motifScale),
  };
  return TOPICS.filter((t) => answered[t]);
}

// The pattern needs these; a suggestion alone does not settle them.
const REQUIRED: Topic[] = ["shapes", "colours", "arrangement"];

// Required topics settle on an explicit answer; scene and detail on any value.
function settledTopics(profile: Profile): Topic[] {
  const explicit = (field: { origin: string } | undefined) => field?.origin === "explicit";
  const settled: Record<Topic, boolean> = {
    scene: !!profile.scene,
    shapes: explicit(profile.motifs) && !!profile.motifs?.value.length,
    colours: explicit(profile.paletteId),
    arrangement: explicit(profile.layoutId),
    detail: !!(profile.density || profile.motifScale),
  };
  return TOPICS.filter((t) => settled[t]);
}

// Topics still worth a question, in order: not settled or skipped, and asked
// fewer than twice (required) or never (optional), within six questions.
export function openTopics(session: Pick<Session, "profile" | "interview">): Topic[] {
  const { askedTopics, skippedTopics, questionCount } = session.interview;
  if (questionCount >= MAX_QUESTIONS) return [];
  const settled = settledTopics(session.profile);
  const timesAsked = (t: Topic) => askedTopics.filter((a) => a === t).length;
  return TOPICS.filter(
    (t) => !settled.includes(t) && !skippedTopics.includes(t) && timesAsked(t) < (REQUIRED.includes(t) ? 2 : 1),
  );
}

// "ready" means nothing is open: the chat invites the user to create.
export type NextStep = { kind: "ask"; topic: Topic } | { kind: "ready" };

export function nextStep(session: Pick<Session, "profile" | "interview">): NextStep {
  const [topic] = openTopics(session);
  return topic ? { kind: "ask", topic } : { kind: "ready" };
}

export function currentTopic(session: Session): Topic | undefined {
  return session.interview.askedTopics.at(-1);
}

// ---------------------------------------------------------------------------
// Reply: acknowledgement + unsupported-shape note + next question or review.

// Closest supported motif for shapes the library does not have.
const CLOSEST: Record<string, MotifId> = {
  flower: "leaf", petal: "leaf", star: "dot", heart: "circle", cloud: "circle", spiral: "circle", bubble: "circle",
  triangle: "arch", mountain: "arch", hill: "arch", square: "stripe", diamond: "dot", bird: "wave", fish: "wave", zigzag: "wave",
};
function closestTo(shape: string): MotifId | undefined {
  const word = shape.toLowerCase();
  const forms = [word, word.replace(/s$/, ""), word.replace(/es$/, ""), word.replace(/ies$/, "y")];
  return forms.map((form) => CLOSEST[form]).find(Boolean);
}

function unsupportedNote(shapes: string[]): string {
  return shapes
    .map((shape) => {
      const closest = closestTo(shape);
      return closest
        ? `I don't have ${shape} yet; the closest is ${MOTIFS[closest].label.toLowerCase()}.`
        : `I don't have ${shape}; try waves, circles, dots, stripes, arches, or leaves.`;
    })
    .join(" ");
}

const DENSITY_WORDS: Record<Density, string> = { low: "a spacious feel", medium: "a balanced feel", high: "a busy feel" };

function listWords(words: string[]): string {
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : words[0];
}

function acknowledge(e: Extraction): string {
  if (e.acknowledgement) return e.acknowledgement;
  const parts: string[] = [];
  if (e.scene) parts.push(`“${e.scene}”`);
  if (e.motifs.length) parts.push(listWords(e.motifs.map((m) => MOTIFS[m.id].label.toLowerCase())));
  if (e.paletteId) parts.push(`${PALETTES[e.paletteId.value].label.toLowerCase()} colours`);
  if (e.layoutId) parts.push(`a ${LAYOUTS[e.layoutId.value].label.toLowerCase()} arrangement`);
  if (e.motifScale) parts.push(`${e.motifScale.value} motifs`);
  if (e.density) parts.push(DENSITY_WORDS[e.density.value]);
  if (parts.length) return `Noted: ${listWords(parts)}.`;
  return e.skippedTopics.length ? "No problem, we can leave that." : "Thanks.";
}

// Message IDs are positions in the conversation, which only grows.
const messageId = (session: Session) => `m${session.messages.length}`;

export function addUserMessage(session: Session, text: string): [Session, string] {
  const id = messageId(session);
  return [{ ...session, messages: [...session.messages, { id, role: "user", text }] }, id];
}

function merged(session: Session, e: Extraction, userMessageId: string): { profile: Profile; interview: Interview } {
  return {
    profile: mergeProfile(session.profile, e, userMessageId),
    interview: { ...session.interview, skippedTopics: [...new Set([...session.interview.skippedTopics, ...e.skippedTopics])] },
  };
}

type Reply = { text: string; topic?: Topic; suggestions?: string[] };

// The fallback reply: a summary of what was understood plus the template question.
function templateReply(e: Extraction, step: NextStep): Reply {
  const lead = [acknowledge(e), unsupportedNote(e.unsupportedShapes)].filter(Boolean).join(" ");
  return step.kind === "ask" ? { text: `${lead} ${QUESTIONS[step.topic]}`, topic: step.topic } : { text: `${lead} ${READY_MESSAGE}` };
}

function withReply(session: Session, profile: Profile, interview: Interview, reply: Reply): Session {
  const message: Message = { id: messageId(session), role: "assistant", text: reply.text };
  if (reply.topic) message.topic = reply.topic;
  if (reply.suggestions?.length) message.suggestions = reply.suggestions;
  const next = reply.topic
    ? { ...interview, askedTopics: [...interview.askedTopics, reply.topic], questionCount: interview.questionCount + 1 }
    : interview;
  return { ...session, profile, interview: next, messages: [...session.messages, message] };
}

// Keyword or chip path: apply the answer, then ask the template question.
export function applyExtraction(session: Session, e: Extraction, userMessageId: string): Session {
  const { profile, interview } = merged(session, e, userMessageId);
  return withReply(session, profile, interview, templateReply(e, nextStep({ profile, interview })));
}

// The prompt asks for everyday words; this catches the occasional slip.
const PLAIN_WORDS: Record<string, string> = {
  palette: "colour mix", palettes: "colour mixes", motif: "shape", motifs: "shapes",
  layout: "arrangement", layouts: "arrangements", density: "fullness",
};
export function plainWords(text: string): string {
  return text.replace(/\b(palettes?|motifs?|layouts?|density)\b/gi, (word) => {
    const plain = PLAIN_WORDS[word.toLowerCase()];
    return word[0] === word[0].toUpperCase() ? plain[0].toUpperCase() + plain.slice(1) : plain;
  });
}

// One question per reply: when the model asks more than one, keep its other
// sentences and only the last question, which is the one about the open topic.
export function oneQuestion(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+["”’)]*\s*/g) ?? [text];
  const lastQuestion = sentences.findLastIndex((x) => x.trim().replace(/["”’)]+$/, "").endsWith("?"));
  return sentences
    .filter((x, i) => i === lastQuestion || !x.trim().replace(/["”’)]+$/, "").endsWith("?"))
    .join("")
    .trim();
}

export const polishReply = (text: string) => oneQuestion(plainWords(text));

// Model path: keep the model's reply if it asks about a topic that is still open
// after the merge (or asks nothing when nothing is open); otherwise use the template.
export function applyModelTurn(session: Session, turn: ChatTurn, userMessageId: string): Session {
  const e: Extraction = { ...turn.extraction, acknowledgement: "" };
  const { profile, interview } = merged(session, e, userMessageId);
  const step = nextStep({ profile, interview });
  const fits = turn.askedTopic ? openTopics({ profile, interview }).includes(turn.askedTopic) : step.kind === "ready";
  const reply = fits
    ? {
        text: polishReply(turn.reply),
        topic: turn.askedTopic ?? undefined,
        suggestions: turn.askedTopic ? turn.suggestions.slice(0, 3).map(plainWords) : [],
      }
    : step.kind === "ready"
      ? { text: `Lovely. ${READY_MESSAGE}` } // the model asked about a closed topic; code says ready
      : templateReply(e, step);
  return withReply(session, profile, interview, reply);
}

// The last 12 messages, starting with a user message, as /api/chat expects.
export function recentHistory(session: Session): InterviewRequest["messages"] {
  const firstUser = session.messages.findIndex((m) => m.role === "user");
  const history = session.messages.slice(firstUser).slice(-12).map((m) => ({ role: m.role, text: m.text.slice(0, 1000) }));
  return history.slice(history.findIndex((m) => m.role === "user"));
}

// What /api/chat needs: recent history, the topics open before the latest
// message, and the current profile.
export function interviewRequest(session: Session): InterviewRequest {
  return {
    mode: "interview",
    messages: recentHistory(session),
    profile: session.profile,
    openTopics: openTopics(session),
    questionCount: session.interview.questionCount,
  };
}

export function takeTurn(session: Session, text: string, e: Extraction): Session {
  const [withMessage, id] = addUserMessage(session, text);
  return applyExtraction(withMessage, e, id);
}

// ---------------------------------------------------------------------------
// Chips: one-tap answers that set a value directly, without a model call.

export type Chip = { label: string; extraction: Extraction; swatches?: readonly string[] };

const said = <T,>(value: T): Stated<T> => ({ value, origin: "explicit" });
const chip = (label: string, patch: Partial<Extraction>, swatches?: readonly string[]): Chip => ({
  label, extraction: { ...emptyExtraction(), ...patch }, swatches,
});

export function chipsFor(topic: Topic): Chip[] {
  switch (topic) {
    case "scene":
      return [chip("Skip", { skippedTopics: ["scene"] })];
    case "shapes":
      return MOTIF_IDS.map((id) => chip(MOTIFS[id].label, { motifs: [{ id, role: "equal", origin: "explicit" }] }));
    case "colours":
      return (Object.keys(PALETTES) as PaletteId[]).map((id) => chip(PALETTES[id].label, { paletteId: said(id) }, PALETTES[id].colors));
    case "arrangement":
      return (Object.keys(LAYOUTS) as LayoutId[]).map((id) => chip(LAYOUTS[id].label, { layoutId: said(id) }));
    case "detail":
      return [
        chip("Small and spacious", { motifScale: said<MotifScale>("small"), density: said<Density>("low") }),
        chip("Medium", { motifScale: said<MotifScale>("medium"), density: said<Density>("medium") }),
        chip("Large and busy", { motifScale: said<MotifScale>("large"), density: said<Density>("high") }),
        chip("Skip", { skippedTopics: ["detail"] }),
      ];
  }
}

// ---------------------------------------------------------------------------
// Keyword fallback: a small word list that reads the demo answers without a
// model. Shape names are explicit; hints such as "beach" are suggestions.

const MOTIF_WORDS: Record<MotifId, { names: string[]; hints: string[] }> = {
  wave: { names: ["wave", "waves", "wavy"], hints: ["water", "sea", "ocean", "beach", "river", "tide", "lake", "flowing"] },
  circle: { names: ["circle", "circles", "ring", "rings"], hints: ["moon", "sun", "ripple", "ripples", "pond", "round"] },
  dot: { names: ["dot", "dots", "dotted", "spot", "spots", "polka"], hints: ["rain", "raindrops", "pebble", "pebbles", "sand", "snow"] },
  stripe: { names: ["stripe", "stripes", "striped", "line", "lines"], hints: ["awning", "awnings", "fields", "linear"] },
  arch: { names: ["arch", "arches", "arc", "arcs"], hints: ["doorway", "doorways", "door", "doors", "rainbow", "bridge", "bridges", "window", "windows", "shophouse", "shophouses"] },
  leaf: { names: ["leaf", "leaves", "leafy"], hints: ["plant", "plants", "garden", "forest", "tree", "trees", "nature", "botanical", "jungle", "rainforest"] },
};

// Colour words the user says are explicit; moods and scenes are suggestions.
const PALETTE_WORDS: Record<PaletteId, { names: string[]; hints: string[] }> = {
  warm: { names: ["warm", "warmer", "red", "orange", "terracotta", "brown", "ochre", "rust", "golden", "gold"], hints: ["earthy", "autumn", "sunset", "cosy", "cozy"] },
  cool: { names: ["cool", "cooler", "blue", "blues", "navy", "grey", "gray", "silver"], hints: ["cream", "icy", "pale", "misty", "winter"] },
  green: { names: ["green", "greens", "sage", "olive", "moss", "mint", "emerald"], hints: ["spring", "fresh"] },
  vivid: { names: ["vivid", "bright", "colourful", "colorful", "vibrant", "pink", "teal", "yellow", "mustard", "raspberry", "magenta"], hints: ["bold", "neon", "festive", "carnival"] },
};

const LAYOUT_WORDS: Record<LayoutId, string[]> = {
  grid: ["regular", "regularly", "grid", "rows", "neat", "neatly", "ordered", "orderly", "evenly", "aligned", "tidy", "symmetrical"],
  scattered: ["scattered", "scatter", "random", "randomly", "loose", "loosely", "irregular", "freely"],
};

const DENSITY_WORDS_IN: Record<Density, { names: string[]; hints: string[] }> = {
  low: { names: ["spacious", "sparse", "airy", "open", "minimal", "uncluttered"], hints: ["quiet", "calm", "peaceful", "simple", "gentle", "serene", "still"] },
  medium: { names: ["balanced"], hints: [] },
  high: { names: ["busy", "dense", "packed", "crowded"], hints: ["lively", "energetic", "bustling", "festive"] },
};

const SIZE_WORDS: Record<MotifScale, string[]> = {
  small: ["small", "smaller", "tiny", "little", "delicate"],
  medium: ["medium"],
  large: ["large", "larger", "big", "bigger", "huge", "chunky"],
};

const MAIN_MARKERS = ["mostly", "mainly", "lots", "plenty", "main", "primarily"];
const ACCENT_MARKERS = ["few", "some", "little", "occasional", "accent", "accents", "touch", "sprinkle", "hint"];
const NEGATIONS = ["no", "not", "without", "except", "instead", "avoid", "don't", "dont", "hate"];
const SKIP_PHRASE = /\b(skip|pass|no idea|not sure|don'?t know|dunno|no preference|anything|whatever|surprise me|you choose|up to you|doesn'?t matter)\b/;

function strongest<K extends string>(words: string[], table: Record<K, { names: string[]; hints: string[] }>): Stated<K> | null {
  let best: { key: K; score: number; named: boolean } | null = null;
  for (const key of Object.keys(table) as K[]) {
    const named = words.filter((w) => table[key].names.includes(w)).length;
    const hinted = words.filter((w) => table[key].hints.includes(w)).length;
    const score = named * 2 + hinted;
    if (score > 0 && (!best || score > best.score)) best = { key, score, named: named > 0 };
  }
  return best ? { value: best.key, origin: best.named ? "explicit" : "suggested" } : null;
}

export function keywordExtract(text: string, topic?: Topic): Extraction {
  const lower = text.toLowerCase();
  const words = lower.match(/[a-z']+/g) ?? [];
  const e = emptyExtraction();
  const near = (i: number, markers: string[], span: number) => words.slice(Math.max(0, i - span), i).some((w) => markers.includes(w));

  words.forEach((word, i) => {
    for (const id of MOTIF_IDS) {
      const isName = MOTIF_WORDS[id].names.includes(word);
      if (!isName && !MOTIF_WORDS[id].hints.includes(word)) continue;
      const found = e.motifs.findIndex((m) => m.id === id);
      if (isName && near(i, NEGATIONS, 2)) {
        e.excludedIngredientIds.push(id);
      } else if (e.excludedIngredientIds.includes(id) || (found >= 0 && (!isName || e.motifs[found].origin === "explicit"))) {
        continue;
      } else {
        // A shape named outright replaces an earlier hint for it ("beach … waves").
        const role = !isName ? "equal" : near(i, MAIN_MARKERS, 3) ? "main" : near(i, ACCENT_MARKERS, 3) ? "accent" : "equal";
        const motif = { id, role, origin: isName ? "explicit" : "suggested" } as const;
        if (found >= 0) e.motifs[found] = motif;
        else e.motifs.push(motif);
      }
    }
    const closest = closestTo(word);
    if (closest && !near(i, NEGATIONS, 2) && !e.unsupportedShapes.includes(word)) {
      e.unsupportedShapes.push(word);
      if (!e.motifs.some((m) => m.id === closest)) e.motifs.push({ id: closest, role: "equal", origin: "suggested" });
    }
  });

  e.paletteId = strongest(words, PALETTE_WORDS);
  const layout = (Object.keys(LAYOUT_WORDS) as LayoutId[]).find((id) => words.some((w) => LAYOUT_WORDS[id].includes(w)));
  if (layout) e.layoutId = said(layout);
  e.density = /\b(not|less)\s+(too\s+|so\s+)?busy\b/.test(lower) ? said<Density>("low") : strongest(words, DENSITY_WORDS_IN);
  const size = (Object.keys(SIZE_WORDS) as MotifScale[]).find((id) =>
    words.some((w, i) => SIZE_WORDS[id].includes(w) && !(w === "little" && words[i - 1] === "a")),
  );
  if (size) e.motifScale = said(size);

  // The first sentence of an answer to the opening question is the scene.
  if (topic === "scene" && !SKIP_PHRASE.test(lower)) {
    const first = text.split(/[.!?\n]/)[0].trim();
    if (first) e.scene = first.length > 80 ? `${first.slice(0, 77)}…` : first;
  }

  const filled: Record<Topic, boolean> = {
    scene: !!e.scene, shapes: e.motifs.length > 0, colours: !!e.paletteId, arrangement: !!e.layoutId, detail: !!(e.density || e.motifScale),
  };
  if (topic && !filled[topic] && SKIP_PHRASE.test(lower)) e.skippedTopics.push(topic);
  return e;
}

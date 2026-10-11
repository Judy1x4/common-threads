// zod schemas for /api/chat: the browser's request and the model's structured
// turn (docs/CONVERSATION_PLAN.md §4). The model schema doubles as Claude's
// output format, so it uses nullable fields rather than optional ones.
import { z } from "zod";
import { DENSITIES, LAYOUT_IDS, MOTIF_IDS, MOTIF_SCALES, PALETTE_IDS, TOPICS } from "./types";

export const MAX_HISTORY = 12;
export const MAX_MESSAGE_CHARS = 1000;

const Origin = z.enum(["explicit", "suggested"]);
const stated = <T extends readonly [string, ...string[]]>(values: T) =>
  z.object({ value: z.enum(values), origin: Origin }).nullable();

export const ExtractionSchema = z.object({
  scene: z.string().nullable().describe("The place, memory, or feeling in the user's own words, or null"),
  motifs: z.array(z.object({ id: z.enum(MOTIF_IDS), role: z.enum(["main", "accent", "equal"]), origin: Origin })),
  excludedIngredientIds: z.array(z.enum(MOTIF_IDS)),
  paletteId: stated(PALETTE_IDS),
  layoutId: stated(LAYOUT_IDS),
  density: stated(DENSITIES),
  motifScale: stated(MOTIF_SCALES),
  skippedTopics: z.array(z.enum(TOPICS)),
  unsupportedShapes: z.array(z.string()),
});

export const ChatTurnSchema = z.object({
  extraction: ExtractionSchema,
  reply: z.string().describe("A short reflection plus at most one question; at most 45 words"),
  askedTopic: z.enum(TOPICS).nullable().describe("The topic the question asks about, or null when ready to create"),
  suggestions: z.array(z.string()).describe("Three short example answers in the user's voice, at most 8 words each"),
});
export type ChatTurn = z.infer<typeof ChatTurnSchema>;

// Profile fields as the browser sends them; values are checked against the catalogue.
const field = <T extends z.ZodType>(value: T) =>
  z.object({ value, origin: z.enum(["explicit", "suggested", "default"]), messageId: z.string().optional() }).optional();

export const ProfileSchema = z.object({
  scene: field(z.string().max(MAX_MESSAGE_CHARS)),
  motifs: field(z.array(z.object({ id: z.enum(MOTIF_IDS), role: z.enum(["main", "accent"]).optional() })).max(3)),
  excludedIngredientIds: z.array(z.enum(MOTIF_IDS)),
  paletteId: field(z.enum(PALETTE_IDS)),
  layoutId: field(z.enum(LAYOUT_IDS)),
  density: field(z.enum(DENSITIES)),
  motifScale: field(z.enum(MOTIF_SCALES)),
});

export const InterviewRequestSchema = z.object({
  mode: z.literal("interview"),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().min(1).max(MAX_MESSAGE_CHARS) }))
    .min(1)
    .max(MAX_HISTORY),
  profile: ProfileSchema,
  openTopics: z.array(z.enum(TOPICS)),
  questionCount: z.number().int().min(0).max(20),
});
export type InterviewRequest = z.infer<typeof InterviewRequestSchema>;

// mode "finish": sent when the user clicks Create pattern.
export const FinishRequestSchema = InterviewRequestSchema.omit({ mode: true, openTopics: true, questionCount: true }).extend({
  mode: z.literal("finish"),
  missing: z.array(z.enum(TOPICS)),
});
export type FinishRequest = z.infer<typeof FinishRequestSchema>;

export const FinishTurnSchema = z.object({
  extraction: ExtractionSchema.describe("Suggestions for the missing choices only"),
  name: z.string().describe("A 2–3 word title for the pattern"),
  description: z.string().describe("At most 35 words about the place and feeling of the pattern"),
});
export type FinishTurn = z.infer<typeof FinishTurnSchema>;

export const ChatRequestSchema = z.discriminatedUnion("mode", [InterviewRequestSchema, FinishRequestSchema]);

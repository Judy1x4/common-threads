// Shared types for the conversation, recipe, and renderer
// (docs/IMPLEMENTATION_PLAN.md §3 and §5).

export const MOTIF_IDS = ["wave", "circle", "dot", "stripe", "arch", "leaf"] as const;
export const PALETTE_IDS = ["warm", "cool", "green", "vivid"] as const;
export const LAYOUT_IDS = ["grid", "scattered"] as const;
export const DENSITIES = ["low", "medium", "high"] as const;
export const MOTIF_SCALES = ["small", "medium", "large"] as const;
export const TOPICS = ["scene", "shapes", "colours", "arrangement", "detail"] as const;

export type MotifId = (typeof MOTIF_IDS)[number];
export type PaletteId = (typeof PALETTE_IDS)[number];
export type LayoutId = (typeof LAYOUT_IDS)[number];
export type Density = (typeof DENSITIES)[number];
export type MotifScale = (typeof MOTIF_SCALES)[number];
export type Topic = (typeof TOPICS)[number];

export type MotifRole = "main" | "accent";
// The chat (with any result cards) or the choices form.
export type Phase = "INTERVIEW" | "REVIEW";

// Where a profile value came from: the user said it, the AI inferred it, or code filled it in.
export type Origin = "explicit" | "suggested" | "default";
export type Field<T> = { value: T; origin: Origin; messageId?: string };

export type MotifChoice = { id: MotifId; role?: MotifRole }; // no role = equal weight

export type Profile = {
  scene?: Field<string>;
  motifs?: Field<MotifChoice[]>;
  excludedIngredientIds: MotifId[];
  paletteId?: Field<PaletteId>;
  layoutId?: Field<LayoutId>;
  density?: Field<Density>;
  motifScale?: Field<MotifScale>;
};

// An assistant message that asks about a topic carries it, plus the model's
// example answers; without them, the chat shows that topic's fixed chips. A
// message with a design is a result card.
export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  topic?: Topic;
  suggestions?: string[];
  design?: Design;
};

// What one user message says, from keyword matching or the model (same shape as
// the Step 0 test schema). "suggested" means inferred, e.g. beach → wave.
export type Stated<T> = { value: T; origin: "explicit" | "suggested" };
export type Extraction = {
  scene: string | null;
  motifs: { id: MotifId; role: MotifRole | "equal"; origin: "explicit" | "suggested" }[];
  excludedIngredientIds: MotifId[];
  paletteId: Stated<PaletteId> | null;
  layoutId: Stated<LayoutId> | null;
  density: Stated<Density> | null;
  motifScale: Stated<MotifScale> | null;
  skippedTopics: Topic[];
  unsupportedShapes: string[];
  acknowledgement: string; // empty: code writes one from the extracted values
};

export type Interview = {
  phase: Phase;
  questionCount: number;
  askedTopics: Topic[];
  skippedTopics: Topic[];
};

export type Ingredient = { id: MotifId; role?: MotifRole; weight: number; count: number };
export type Reason = { text: string; messageId?: string };

export type Recipe = {
  ingredients: Ingredient[];
  layoutId: LayoutId;
  paletteId: PaletteId;
  density: Density;
  motifScale: MotifScale;
  excludedIngredientIds: MotifId[];
  seed: number;
  reasons: Reason[];
  artworkVersion: number;
};

// One logical motif in the tile. colorRank 1 is the palette ink with the most
// contrast. Hex colours and size are resolved from the recipe at render time,
// so palette and size edits never move anything.
export type Placement = { motifId: MotifId; x: number; y: number; rotation: number; colorRank: 1 | 2 | 3 };
export type RenderPlan = Placement[];

// A finished pattern. Result-card messages keep their own snapshot, so earlier
// versions stay as they were.
export type Design = { name: string; description: string; recipe: Recipe; plan: RenderPlan };

export type Session = {
  messages: Message[];
  profile: Profile;
  interview: Interview;
  sampleId?: string; // set when the profile came from "Try sample"
  design?: Design; // the latest design
  previousDesign?: Design; // for Undo
};

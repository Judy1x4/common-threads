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
export type Phase = "INTERVIEW" | "REVIEW" | "RESULT";

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

export type Message = { id: string; role: "user" | "assistant"; text: string };

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

export type Session = {
  messages: Message[];
  profile: Profile;
  interview: Interview;
  currentRecipe?: Recipe;
  previousRecipe?: Recipe;
  renderPlan?: RenderPlan;
};

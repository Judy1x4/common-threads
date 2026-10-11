// Step 0 check: the API key works and Claude returns the structured profile
// updates planned in docs/IMPLEMENTATION_PLAN.md §3.
// Run: npm run test:claude            (uses the demo message)
//      npm run test:claude -- "your own message"
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const MOTIF_IDS = ["wave", "circle", "dot", "stripe", "arch", "leaf"] as const;
const TOPICS = ["scene", "shapes", "colours", "arrangement", "detail"] as const;

const Origin = z.enum(["explicit", "suggested"]);
const choice = <T extends readonly [string, ...string[]]>(values: T) =>
  z.object({ value: z.enum(values), origin: Origin }).nullable();

const ExtractionSchema = z.object({
  scene: z.string().nullable().describe("The scene, memory, or feeling in the user's words, or null"),
  motifs: z.array(
    z.object({ id: z.enum(MOTIF_IDS), role: z.enum(["main", "accent", "equal"]), origin: Origin }),
  ),
  excludedIngredientIds: z.array(z.enum(MOTIF_IDS)),
  paletteId: choice(["warm", "cool", "green", "vivid"] as const),
  layoutId: choice(["grid", "scattered"] as const),
  density: choice(["low", "medium", "high"] as const),
  motifScale: choice(["small", "medium", "large"] as const),
  skippedTopics: z.array(z.enum(TOPICS)),
  unsupportedShapes: z.array(z.string()),
  acknowledgement: z.string().describe("At most 20 words; asks no question"),
});

const SYSTEM = `You extract textile-pattern preferences from a user's chat message for Common Threads.

Catalogue
- Motifs: wave (water, flowing), circle (round, simple), dot (small, accent), stripe (linear, rhythmic), arch (curved, structured), leaf (plant, organic)
- Palettes: warm (cream, terracotta, ochre, brown), cool (cream, navy, blue-grey, pale grey), green (cream, forest, sage, clay), vivid (cream, raspberry, teal, mustard)
- Layouts: grid (regularly arranged), scattered
- Density: low, medium, high. Motif size: small, medium, large.

Rules
- Use only catalogue IDs. Put shapes the catalogue lacks in unsupportedShapes.
- origin "explicit" means the user stated the choice; "suggested" means you inferred it (for example, beach suggests wave and quiet suggests low density).
- Return null or an empty list for anything the message does not mention. Never invent answers.
- role: "main" if the user emphasises a motif, "accent" for minor ones, "equal" otherwise.
- acknowledgement: a warm reply of at most 20 words that reflects what they said. Do not ask a question.`;

const message = process.argv[2] ?? "A quiet beach. Mostly small waves, a few circles. Blue and cream.";
const model = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is empty. Paste your key into .env.local, then run npm run test:claude again.");
  process.exit(1);
}

const client = new Anthropic();
const started = Date.now();

try {
  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    // Server-side fallback reruns a declined request on another model. Haiku has none.
    ...(model.includes("haiku") ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
    output_config: { effort: "low", format: betaZodOutputFormat(ExtractionSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: message }],
  });

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (response.stop_reason === "refusal") {
    console.error(`Claude declined the request (${response.stop_details?.category ?? "no category"}).`);
    process.exit(1);
  }
  if (!response.parsed_output) {
    console.error(`No structured output (stop reason: ${response.stop_reason}).`);
    process.exit(1);
  }

  console.log(`Model: ${response.model} · ${seconds}s · ${response.usage.input_tokens} in / ${response.usage.output_tokens} out tokens`);
  console.log(`Message: "${message}"\n`);
  console.log(JSON.stringify(response.parsed_output, null, 2));
  console.log("\nStep 0 check passed: the key works and the output matches the schema.");
} catch (error) {
  if (error instanceof Anthropic.AuthenticationError) {
    console.error("The API key was rejected. Check ANTHROPIC_API_KEY in .env.local.");
  } else if (error instanceof Anthropic.RateLimitError) {
    console.error("Rate limited. Wait a minute and try again.");
  } else if (error instanceof Anthropic.APIError) {
    console.error(`API error ${error.status}: ${error.message}`);
  } else {
    throw error;
  }
  process.exit(1);
}

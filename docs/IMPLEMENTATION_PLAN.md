# Common Threads — implementation plan

**Track: Design × Tech.** A guided chat produces a textile pattern using the artist's original drawings.

**Flow:** Chat → review preferences → create pattern → edit → download.

## 1. Stack and scope

| Area | Decision | Purpose |
| --- | --- | --- |
| Frontend | Next.js + React + TypeScript | Chat, review, pattern preview, edits, download |
| Backend | Next.js API routes on Node.js | Model calls only; validate their output |
| AI | One Claude call per user message (`claude-opus-5-5` at low effort; override with `ANTHROPIC_MODEL`) | Extract preferences, write a short acknowledgement, interpret edits |
| Application code | TypeScript in the browser | Choose questions, merge the profile, build recipes, render, export |
| Storage | Browser localStorage | Save the current chat, profile, recipe, and render plan |
| Artwork | Six original SVG drawings + two layouts | Compose patterns in TypeScript |
| Fallback | Review form, suggestion chips, keyword matching | Complete the whole flow without the model |
| Deployment | One Next.js application | Keep the build manageable |

Use TypeScript throughout. Keep the model API key on the server, and validate browser-supplied data and model output with zod. The session survives reloads in the same browser. An existing React/Node app can use the same structure.

The prototype uses original art and visual preferences. Cultural-reference selection, image-model generation, model training, RAG, accounts, a saved-chats sidebar, progress stages, and model-written questions are outside this build.

### Key decisions

| Decision | Reason |
| --- | --- |
| One model call per message; code words the next question from a template | Halves latency and failure points; questions stay predictable |
| The server only interprets language; the recipe, render plan, explanation, and PNG are built in the browser | No `/api/design`; the explanation comes from the recipe's own reasons, so it always matches the pattern |
| Build the review form before the chat | The chat fills the form; the form is also the fallback and the sample demo |
| Draw every motif at all nine tile offsets | Seamless by construction; no edge-crossing detection |
| Fixed motif sizes, independent of density | As a percentage of the cell, "small + spacious" (45% of 256 = 115 px) drew bigger motifs than "large + busy" (85% of 128 = 109 px) |
| Scattered picks well-spaced points across the wrapped tile | Offsets inside cells have no room at large sizes, so scattered looked like the grid |
| One precedence rule for corrections | Replaces separate correction, contradiction, and quote-check logic; review catches the rest |
| The render plan stores colour indexes, not hex values or sizes | Palette and size edits cannot move any motif |

## 2. Guided conversation

The model understands answers. **Code tracks missing information, chooses the next question, and words it from a template.**

| Term | Meaning |
| --- | --- |
| Profile | User statements and confirmed visual preferences |
| Ingredient / motif | An original drawing available for the pattern |
| Recipe | Which motifs, counts, colours, layout, and sizes to use |
| Render plan | Exact positions, rotations, and colour assignments |

### Question topics

| Topic | Question template | Chips | Collect |
| --- | --- | --- | --- |
| Scene | “What scene, memory, or feeling should the pattern reflect?” | Skip | Optional personal context |
| Shapes | “Which shapes would you like: waves, circles, leaves, or something else?” | The six motifs | 1–3 supported motif IDs; main/accent emphasis; exclusions |
| Colours | “What colours would you like?” | The four palettes, as swatches | One supported palette |
| Arrangement | “Regularly arranged or scattered?” | Regular · Scattered | Layout |
| Detail | “Small and spacious, or large and busy?” | Small and spacious · Medium · Large and busy | Motif size and density |

One answer may fill several topics. The bot's reply is the model's acknowledgement (at most 20 words) followed by the next templated question and its chips. Clicking a chip sets the value directly, without a model call.

| Situation | Code action |
| --- | --- |
| Topic already answered | Skip its question |
| Explicit correction | The newer explicit value replaces the old one; record the new supporting message |
| Suggestion conflicts with an explicit choice | Keep the explicit choice |
| User skips | Keep it skipped; leave personal context empty |
| Unsupported shape | Name the closest supported motif, e.g. “There's no star; the closest is dot.” |
| Missing design choice | Ask about the first unanswered topic |
| Choices complete, or six questions asked | Show review |
| User clicks **Create pattern** early | Show review immediately |

**Precedence:** explicit > suggested > default; among explicit values, the newest wins. Show **Create pattern** after the first substantive answer.

Generation requires confirmed motif IDs, palette, and layout. Default density and size to **medium**, shown in review. Scene/memory is optional. Every AI suggestion must be accepted or changed in review; explicit choices override suggestions.

## 3. Memory and each-message workflow

| Saved object | Contents |
| --- | --- |
| `messages` | Full short conversation with stable message IDs |
| `profile` | Scene, motif choices/emphasis, palette, layout, density, size, exclusions |
| `interview` | Phase, question count, asked and skipped topics |
| `currentRecipe`, `previousRecipe` | Current design and one previous version for **Undo** |
| `renderPlan` | Resolved placements used for preview and export |

Profile values include supporting message IDs and an origin: **explicit**, **suggested**, or **default**. Leave unknown values empty. **New chat** clears the session; reloading restores it.

```ts
type Origin = 'explicit' | 'suggested' | 'default'
type Field<T> = { value: T; origin: Origin; messageId?: string }

type Profile = {
  scene?: Field<string>
  motifs?: Field<{ id: MotifId; role?: 'main' | 'accent' }[]> // no role = equal weight
  excludedIngredientIds: MotifId[]
  paletteId?: Field<'warm' | 'cool' | 'green' | 'vivid'>
  layoutId?: Field<'grid' | 'scattered'>
  density?: Field<'low' | 'medium' | 'high'>
  motifScale?: Field<'small' | 'medium' | 'large'>
}

type Placement = { motifId: MotifId; x: number; y: number; rotation: number; colorIndex: 1 | 2 | 3 }
```

| Step | Runs in | Action |
| --- | --- | --- |
| 1. Save | Browser | Save the session before calling the model |
| 2. Extract | `/api/extract` (one model call) | Return structured updates, skipped topics, unsupported shapes, and an acknowledgement |
| 3. Validate | Server | Check the schema; drop unknown IDs and message IDs not in the conversation |
| 4. Merge | Browser | Apply the precedence rule; remove excluded motifs; update answered topics |
| 5. Reply | Browser | Choose the next topic or review; show acknowledgement + templated question + chips |

The extraction prompt includes the catalogue IDs and tags, the palette descriptions, and these rules: use only supported IDs; mark interpretations such as beach → `wave` as suggestions; never invent answers; the acknowledgement asks no question.

If the call fails or takes more than 15 s, run `keywordExtract` on the message, use a fixed acknowledgement, and show a small **AI unavailable – retry** notice. The session is already saved.

**Phases:** `INTERVIEW → REVIEW → RESULT`. Design edits update the result; profile corrections offer regeneration.

## 4. Artist's ingredient library

Prepare six original motifs in a consistent drawing style.

| ID | Drawing | Chosen file | Suggestion tags | Starting rotations |
| --- | --- | --- | --- | --- |
| `wave` | Two curved wave lines | `wave-1` | Water, flowing | 0°, 180° |
| `circle` | Double-ring outline | `circle-3` | Round, simple | Any |
| `dot` | Three filled dots | `dot-1` | Small, accent | Any |
| `stripe` | Three short parallel lines | `stripe-3` | Linear, rhythmic | 0°, 90° |
| `arch` | Double curved arch | `arch-3` | Curved, structured | 0°, 180° |
| `leaf` | Simple leaf outline | `leaf-1` | Plant, organic | 0°, 180° |

The chosen set repeats lines (double wave, ring, and arch; three stripes and dots), which ties the drawings together and keeps them readable at small sizes.

Each record stores an ID, SVG path data, bounds, suggestion tags, and permitted rotations. The artist confirms the rotations. Use trusted local assets.

**Artwork pipeline:**

1. Draw each motif in one consistent style: black on white, one PNG per drawing in `assets/` (e.g. `wave-1.png`), not touching the edges.
2. Run `node scripts/trace-motifs.ts`. It traces every PNG, centres it in a 100 × 100 viewBox as one `fill="currentColor"` path, and writes `assets/traced/`: one SVG per drawing, `motifs.json`, and `preview.png` showing each motif at its on-screen sizes.
3. Choose one drawing per motif and copy its path into `lib/catalogue.ts`.

Higher-resolution sources (about 1000 px) give smoother edges in the 2048 px PNG export. Start with placeholder shapes in the same format so the renderer is not blocked on artwork.

Tags help the AI suggest ingredients and feed the keyword fallback. For example, “beach” can suggest `wave`; it does not automatically select it. If a user asks for an unsupported shape, offer a supported alternative.

## 5. Profile → recipe → one textile image

**Decision: use an SVG composer for the prototype.** Composition is implemented in code; the model interprets language. Everything in this section runs in the browser.

### A. Recipe controls

| Field | Choices | Effect |
| --- | --- | --- |
| `ingredients` | 1–3 library IDs, each with a role, weight, and count | Drawings to include and how many of each |
| `layoutId` | Grid / scattered | Placement rule |
| `paletteId` | Warm / cool / green / vivid | Background and motif colours |
| `density` | Low / medium / high | 4 / 9 / 16 logical motif placements |
| `motifScale` | Small / medium / large | Fixed sizes: 55 / 80 / 110 px in the 512 px tile |
| `excludedIngredientIds` | Library IDs | Drawings that must not appear |
| `seed` | Integer | Reproducible placement variation |
| `reasons` | Short text with supporting message IDs | Why each significant choice was made |

Size and density are independent: large motifs at high density still fit a 128 px grid cell. Tune the three sizes in `/lab`.

| Palette | Colours; first is the background |
| --- | --- |
| Warm | `#F2E5CE` `#B96446` `#D5A24C` `#42372E` |
| Cool | `#F6F0E2` `#294F6D` `#769CAF` `#BFC9C7` |
| Green | `#F3EADB` `#426451` `#93AA8D` `#C78562` |
| Vivid | `#FFF2D8` `#CF4D64` `#247D8C` `#E8B13E` |

**Colours:** the main motif gets the palette colour with the most contrast against the background; accents get the others. Light colours such as cool's `#BFC9C7` nearly disappear on the background, so keep them for accents. With one motif, alternate the two strongest colours.

**Counts:** code removes exclusions and uses confirmed choices. Equal choices get weight 1 each; a main motif gets weight 3 and each accent weight 1. Allocate the density budget proportionally, round using largest remainders, and ensure each selected motif appears at least once. Store reasons and supporting message IDs.

Example: “Mostly waves, a few circles; blue and cream; small, spacious, scattered.”

```json
{
  "layoutId": "scattered",
  "paletteId": "cool",
  "density": "low",
  "motifScale": "small",
  "ingredients": [
    { "id": "wave", "role": "main", "weight": 3, "count": 3 },
    { "id": "circle", "role": "accent", "weight": 1, "count": 1 }
  ],
  "excludedIngredientIds": [],
  "seed": 42,
  "reasons": [
    { "text": "Waves are the main shape because you said “mostly small waves”.", "messageId": "m2" }
  ]
}
```

### B. Turn the recipe into a composition

| Step | Concrete implementation |
| --- | --- |
| 1. Make a tile | Create one 512 × 512 SVG square; fill its background |
| 2. Count placements | Density gives 4, 9, or 16 placements; grid uses a 2 × 2, 3 × 3, or 4 × 4 cell grid |
| 3. Assign motifs | Expand ingredient counts into a list; shuffle it with a seeded generator (e.g. mulberry32) |
| 4. Place them | Grid uses cell centres. Scattered tries ~10 seeded random points per motif and keeps the one farthest from those already placed, measuring distance across the wrapped edges |
| 5. Assign style | Colour index by role; a rotation from the motif's permitted list |
| 6. Handle boundaries | Draw every placement at all nine offsets (0 or ±512 on each axis); the tile's viewBox crops them, so opposite edges always match |
| 7. Save the render plan | Store motif ID, x/y, rotation, and colour index for every logical placement |
| 8. Preview/export | Repeat the tile in a 3 × 3 view and scarf shape; export the same tile as PNG |

The render plan does not store hex colours or sizes; `renderTile` reads them from the recipe, so palette and size edits redraw the same positions. Offset copies do not increase recipe counts.

Thin hand-drawn lines fade at small sizes, so `renderTile` adds a same-colour stroke to each motif path to thicken its lines; tune the width in `/lab`. Define each motif once in `<defs>` and place it with `<use>`, so the nine copies per placement keep the tile small.

Use a shared palette, coordinated line weights, and tuned placement rules to make the drawings read as one design. The artist should approve sample combinations in `/lab` before integrating chat.

### C. Browser rendering and export

| Function | Responsibility |
| --- | --- |
| `allocateCounts(ingredients, density)` | Weighted counts with largest remainders; at least one of each motif |
| `buildRenderPlan(recipe)` | Resolve positions, rotations, and colour indexes with the seeded generator |
| `renderTile(recipe, plan)` | Build a self-contained SVG string from local motif geometry, palette, and size |
| `renderRepeat(tile)` | Fill a larger preview or the scarf shape with SVG `<pattern>` |
| `exportPng(tile)` | Load the SVG into an image, draw it on a 2048 × 2048 canvas, export with `toBlob` |

Keep motif geometry embedded in the SVG, so export needs no external asset fetches. A recipe, seed, and unchanged artwork/layout version reproduce the same result. Save version IDs alongside the recipe.

The `/lab` page shows 6–8 hand-written sample recipes as 3 × 3 repeats, with a new-seed button and a toggle that outlines tile edges. Use it to tune sizes, spacing, and colour rules, and to take screenshots for the presentation.

Documentation: [SVG repeats](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/pattern), [canvas drawing](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage), [PNG export](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob).

### D. Why this approach?

| Approach | Strength | Decision |
| --- | --- | --- |
| Code composes SVG motifs | Exact drawings, counts, repeat boundaries, and targeted edits | Build this first |
| Image model generates the tile | Richer texture and new visual forms | Defer; prompted composition and seams need checking |
| SVG composition → image-model styling | Controlled starting layout with a richer finish | Later experiment; keep the original SVG and review changed geometry |

Image generation and editing are possible, but model documentation still lists precise composition and consistency as limitations. The recommendation above is an engineering choice for this prototype. [OpenAI image generation guide](https://developers.openai.com/api/docs/guides/image-generation)

## 6. Editing

The result view has edit buttons: **Warmer / Cooler**, **Smaller / Larger**, **Calmer / Busier**, **Shuffle**, and **Undo**. Chat requests do the same through `/api/edit`.

| Request | Code action |
| --- | --- |
| “Make the motifs smaller” | Step `motifScale` down; redraw the same plan |
| “Use warmer colours” | Change `paletteId`; redraw the same plan |
| “Make it less busy” | Step `density` down; recalculate counts; rebuild the plan with the same seed |
| “Scatter them” | Change `layoutId`; rebuild with the same seed |
| “Remove leaves” | Remove that ingredient; redistribute counts across remaining motifs; rebuild |
| “Use circles instead of waves” | Replace the ingredient; rebuild with the same seed |
| **Shuffle** | Increase the seed; rebuild |
| “Why these shapes?” | Answer from the recipe's reasons |

The model returns one supported operation: `setPalette | stepSize | stepDensity | setLayout | removeMotif | replaceMotif | explain`. Code applies it, validates the result, and keeps the old recipe for **Undo**. Preserve unrelated recipe settings. If a setting is already at its limit, say so. If an edit removes the last motif, ask for a replacement. If the call fails, use keyword matching.

## 7. UI, APIs, and files

Use the supplied EveryHuman screenshots as the interaction reference.

| UI element | Behaviour |
| --- | --- |
| Header | **New chat**; **Try sample** loads a labelled sample profile |
| Chat + fixed input | Short replies; suggestion chips; **Create pattern** |
| Review | Confirm motifs (off / main / accent), palette, layout, size, and density; badges show “you said”, “suggested”, or “default” |
| Result | Pattern repeat, scarf, recipe card (counts, swatches, settings, reasons), edit buttons, **Download PNG** |
| `/lab` | Sample-recipe gallery for tuning (development only) |

| Endpoint | Input | Output |
| --- | --- | --- |
| `POST /api/extract` | Last ~10 messages, profile, current topic | Validated updates, skipped topics, unsupported shapes, acknowledgement |
| `POST /api/edit` | Instruction, recipe summary | One validated edit operation |

The browser builds the recipe, render plan, title, explanation, and PNG; the server only calls the model. The title comes from the scene (e.g. “Quiet Beach”) and the explanation from the recipe's reasons.

```text
app/page.tsx              chat → review → result
app/lab/page.tsx          sample-recipe gallery
app/api/extract/route.ts
app/api/edit/route.ts
lib/types.ts
lib/schemas.ts            zod schemas for requests and model output
lib/catalogue.ts          motifs, palettes, sizes
lib/interview.ts          mergeProfile, nextStep, templates, chips, keywordExtract
lib/recipe.ts             profileToRecipe, allocateCounts, applyEdit, reasons
lib/render.ts             rng, buildRenderPlan, renderTile, exportPng
lib/session.ts            localStorage
```

## 8. Build order

About five hours. Each step ends with something you can check; commit after each one.

### Step 0 — Before the day (only if the rules allow pre-work)

- Put `ANTHROPIC_API_KEY` in `.env.local` (template: `.env.example`), then run `npm run test:claude`. It sends the demo message to Claude and prints the structured extraction (`scripts/test-claude.ts`).
- Sketch or draw the six motifs.

### Step 1 — Scaffold (20 min)

- Create the Next.js app (TypeScript, App Router, Tailwind); add `zod`.
- Write `lib/types.ts` and `lib/catalogue.ts`: the four palettes, three sizes, and six placeholder motifs in the §4 format.
- **Done when** the dev server runs and types compile.

### Step 2 — Recipe and renderer (50 min)

- Implement `rng`, `allocateCounts`, `profileToRecipe`, `buildRenderPlan`, and `renderTile` (§5).
- Build `/lab` with 6–8 contrasting sample recipes.
- **Done when** counts match the recipe, the 3 × 3 shows no seams, the same recipe and seed reproduce the same tile, and contrasting recipes look clearly different.

### Step 3 — Real artwork (40 min, less if pre-drawn)

- Run the §4 pipeline for all six drawings; set permitted rotations.
- Tune sizes, spacing, and colour rules in `/lab`; screenshot the best combinations for the presentation.
- **Done when** the motifs share one drawing style and three contrasting samples are presentation-ready.

### Step 4 — The app without AI (40 min)

- Review form, result view, scarf, recipe card, and PNG export (§5C, §7).
- Save and restore the session; add **Try sample**.
- **Done when** the full flow works without a model and the PNG matches the preview. This is already a demo.

### Step 5 — Interview logic (40 min)

- `mergeProfile` with the precedence rule; `nextStep` with the §2 topic order and review conditions.
- Question templates and chips; chips set values directly.
- `keywordExtract` from motif tags and a small word list (blue → cool, scattered → scattered, quiet → low density).
- **Done when** the demo conversation reaches review with the right values using keywords alone.

### Step 6 — Model extraction (35 min)

- `/api/extract` with the zod schema, extraction prompt, and server validation (§3).
- Acknowledgement + templated question; unsupported-shape message; 15 s timeout with keyword fallback.
- **Done when** one answer fills several fields, “actually, green” replaces the palette, skips stay skipped, and the app still works with the API key removed.

### Step 7 — Edits (25 min)

- Edit buttons and **Undo** first; then `/api/edit` for chat requests (§6).
- **Done when** a palette edit leaves every position unchanged and a density edit keeps the palette and size.

### Step 8 — Check and rehearse (30 min + 20 min buffer)

- Run the completion checks in PROJECT_PLAN §6, including cutting the network mid-chat.
- Rehearse the demo twice.
- Optional: deploy on Vercel with the API key as an environment variable.

| Checkpoint | Target time |
| --- | --- |
| Real artwork in `/lab` | ~1 h 50 |
| App works without AI | ~2 h 30 |
| Chat with model extraction | ~3 h 45 |
| Edits | ~4 h 10 |

**If behind, cut in this order:** chat edits (keep the buttons) → detail question (keep medium defaults) → scarf (keep the 3 × 3) → model extraction (keywords and chips still show the flow).

**Demo:** Share a scene → answer a follow-up → review preferences → create → inspect ingredients → edit → download.

Focus engineering effort on extraction, memory, routing, composition rules, and controlled edits. The six-motif catalogue fits in model context; session memory does not require RAG.

Technical references: [Next.js API routes](https://nextjs.org/docs/app/api-reference/file-conventions/route), [Claude structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).

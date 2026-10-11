# Common Threads — implementation plan

**Track: Design × Tech.** A guided chat produces a textile pattern using the artist's original drawings.

**Flow:** Chat → review preferences → create pattern → edit → download.

## 1. Stack and scope

| Area | Decision | Purpose |
| --- | --- | --- |
| Frontend | Next.js + React + TypeScript | Chat, review, pattern preview, edits, download |
| Backend | Next.js API routes on Node.js | Model calls only; validate their output |
| AI | One Claude call per user message, plus one at Create (`claude-opus-5-5` at low effort; override with `ANTHROPIC_MODEL`) | Lead the conversation: read each answer, write the reply, the next question, and example answers; name the pattern; interpret edits |
| Application code | TypeScript in the browser | Choose questions, merge the profile, build recipes, render, export |
| Storage | Browser localStorage | Save the current chat, profile, recipe, and render plan |
| Artwork | Six original SVG drawings + two layouts | Compose patterns in TypeScript |
| Fallback | Review form, suggestion chips, keyword matching | Complete the whole flow without the model |
| Deployment | One Next.js application | Keep the build manageable |

Use TypeScript throughout. Keep the model API key on the server, and validate browser-supplied data and model output with zod. The session survives reloads in the same browser. An existing React/Node app can use the same structure.

The prototype uses original art and visual preferences. Cultural-reference selection, image-model generation, model training, RAG, accounts, and a saved-chats sidebar are outside this build.

### Key decisions

| Decision | Reason |
| --- | --- |
| The model writes each reply and question; code decides which topics are open and checks the model's choice | Personal questions drawn from the user's own imagery, as in EveryHuman, while code still guarantees the pattern gets what it needs; templates and keyword matching are the fallback ([CONVERSATION_PLAN.md](CONVERSATION_PLAN.md)) |
| The server only interprets language; the recipe, render plan, explanation, and PNG are built in the browser | No `/api/design`; the explanation comes from the recipe's own reasons, so it always matches the pattern |
| Build the review form before the chat | The chat fills the form; the form is also the fallback and the sample demo |
| Draw every motif at all nine tile offsets | Seamless by construction; no edge-crossing detection |
| Fixed motif sizes, independent of density | As a percentage of the cell, "small + spacious" (45% of 256 = 115 px) drew bigger motifs than "large + busy" (85% of 128 = 109 px) |
| Scattered picks well-spaced points across the wrapped tile | Offsets inside cells have no room at large sizes, so scattered looked like the grid |
| One precedence rule for corrections | Replaces separate correction, contradiction, and quote-check logic; review catches the rest |
| The render plan stores colour ranks, not hex values or sizes | Palette and size edits cannot move any motif, and the main motif keeps the strongest colour |

## 2. Guided conversation

The model leads the conversation: it reads each answer and writes the reply, the next question, and three example answers. **Code decides which topics are still open, checks the model's choice, and falls back to the templates below.** Details: [CONVERSATION_PLAN.md](CONVERSATION_PLAN.md).

| Term | Meaning |
| --- | --- |
| Profile | User statements and confirmed visual preferences |
| Ingredient / motif | An original drawing available for the pattern |
| Recipe | Which motifs, counts, colours, layout, and sizes to use |
| Render plan | Exact positions, rotations, and colour assignments |

### Question topics

| Topic | Fallback question | Fallback chips | Collect |
| --- | --- | --- | --- |
| Scene | “What scene, memory, or feeling should the pattern reflect?” | Skip | Optional personal context |
| Shapes | “Which shapes would you like: waves, circles, leaves, or something else?” | The six motifs | 1–3 supported motif IDs; main/accent emphasis; exclusions |
| Colours | “What colours would you like?” | The four palettes, as swatches | One supported palette |
| Arrangement | “Regularly arranged or scattered?” | Regular · Scattered | Layout |
| Detail | “Small and spacious, or large and busy?” | Small and spacious · Medium · Large and busy | Motif size and density |

One answer may fill several topics. The model's reply is a short reflection plus one question (at most 45 words), with three example answers; tapping one sends it as a message. When the model is unavailable, the fallback question and chips appear instead, and a chip sets its value directly.

| Situation | Code action |
| --- | --- |
| Topic already answered | Skip its question |
| Explicit correction | The newer explicit value replaces the old one; record the new supporting message |
| Suggestion conflicts with an explicit choice | Keep the explicit choice |
| User skips | Keep it skipped; leave personal context empty |
| Unsupported shape | Name the closest supported motif, e.g. “There's no star; the closest is dot.” |
| Open topic | The model asks about an open topic. Shapes, colours, and arrangement stay open until answered explicitly and may be asked twice; scene and detail settle on any value and are asked once |
| Nothing open, or six questions asked | Invite the user to create; **Create pattern** turns solid |
| User clicks **Create pattern** early | Create from what is known; missing values are suggested at Create (CONVERSATION_PLAN Step 7) |

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

type Placement = { motifId: MotifId; x: number; y: number; rotation: number; colorRank: 1 | 2 | 3 } // 1 = most contrast
```

| Step | Runs in | Action |
| --- | --- | --- |
| 1. Save | Browser | Add the user message and save the session |
| 2. Ask | Browser → `POST /api/chat` | Send the last 12 messages (from the first user message), the profile, the open topics, and the question count |
| 3. Call | Server | One Claude call with structured output (extraction, reply, askedTopic, suggestions), validated with zod |
| 4. Merge | Browser | `mergeProfile` applies the extraction with the precedence rule |
| 5. Check | Browser | Keep the model's reply if its topic is still open, or if it asks nothing when nothing is open; otherwise use the fallback question |
| 6. Show | Browser | Add the reply and its example answers; save |

The system prompt (`lib/prompt.ts`) holds the catalogue, the topic guide, and the rules, and never changes, so it can be cached. The per-turn state (open and closed topics, question count, current choices) goes in a mid-conversation system message after the latest user message. Colour words the user says are explicit; interpretations such as beach → `wave` or quiet → low density are suggestions.

If the call fails, takes more than 15 s, or fails validation, run `keywordExtract` on the message, use the fallback question and chips, and show **AI unavailable – Retry**. The session is already saved.

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
| `leaf` | Simple leaf outline | `leaf-1` | Plant, organic | 0°, 90°, 180°, 270° |

The chosen set repeats lines (double wave, ring, and arch; three stripes and dots), which ties the drawings together and keeps them readable at small sizes.

Each record stores an ID, SVG path data, bounds, suggestion tags, and permitted rotations. The artist confirms the rotations. Use trusted local assets.

**Artwork pipeline:**

1. Draw each motif in one consistent style: black on white, one PNG per drawing in `assets/raw/` (e.g. `wave-1.png`), not touching the edges.
2. Set the chosen drawing per motif in `CHOSEN` at the top of `scripts/trace-motifs.ts`.
3. Run `npm run trace`. It traces every PNG, centres it in a 100 × 100 viewBox as one `fill="currentColor"` path, and writes `assets/traced/` (one SVG per drawing, `motifs.json`, and `preview.png` showing each motif at its on-screen sizes) plus `lib/motif-paths.ts`, which the catalogue imports.

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

| Palette | Background, then inks from most to least contrast |
| --- | --- |
| Warm | `#F2E5CE` `#42372E` `#B96446` `#D5A24C` |
| Cool | `#F6F0E2` `#294F6D` `#769CAF` `#BFC9C7` |
| Green | `#F3EADB` `#426451` `#C78562` `#93AA8D` |
| Vivid | `#FFF2D8` `#247D8C` `#CF4D64` `#E8B13E` |

**Colours:** each placement stores a colour rank, where rank 1 is the ink with the most contrast against the background. The main motif (or the most frequent) gets rank 1 and accents get ranks 2 and 3, so light colours such as cool's `#BFC9C7` stay on accents and every palette edit keeps the hierarchy. A lone motif uses ranks 1 and 2, split between the first and second half of the spread order (§5B), which gives a checkerboard on the grid.

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
| 3. Order positions | Put the positions in spread order, so each is as far as possible from those before it (seeded with mulberry32) |
| 4. Assign motifs | Grid uses cell centres. Scattered tries 40 seeded random points per motif and keeps the one farthest from those already placed, measuring distance across the wrapped edges. The rarest motifs take the first positions, so accents end up evenly spaced instead of clustered |
| 5. Assign style | Colour rank by role; a rotation from the motif's permitted list |
| 6. Handle boundaries | Draw every placement at all nine offsets (0 or ±512 on each axis); the tile's viewBox crops them, so opposite edges always match |
| 7. Save the render plan | Store motif ID, x/y, rotation, and colour rank for every logical placement |
| 8. Preview/export | Repeat the tile in a 3 × 3 view and scarf shape; export the same tile as PNG |

The render plan does not store hex colours or sizes; `renderTile` reads them from the recipe, so palette and size edits redraw the same positions. Offset copies do not increase recipe counts.

Thin hand-drawn lines fade at small sizes, so `renderTile` adds a same-colour stroke to each motif path to thicken its lines; tune the width in `/lab`. Define each motif once in `<defs>` and place it with `<use>`, so the nine copies per placement keep the tile small.

Use a shared palette, coordinated line weights, and tuned placement rules to make the drawings read as one design. The artist should approve sample combinations in `/lab` before integrating chat.

### C. Browser rendering and export

| Function | Responsibility |
| --- | --- |
| `allocateCounts(ingredients, density)` | Weighted counts with largest remainders; at least one of each motif |
| `buildRenderPlan(recipe)` | Resolve positions, rotations, and colour ranks with the seeded generator |
| `renderTile(recipe, plan)` | Build a self-contained SVG string from local motif geometry, palette, and size |
| `renderRepeat(tile)` | Fill a larger preview or the scarf shape with SVG `<pattern>` |
| `exportPng(tile)` | Load the SVG into an image, draw it on a 2048 × 2048 canvas, export with `toBlob` |

Keep motif geometry embedded in the SVG, so export needs no external asset fetches. A recipe, seed, and unchanged artwork/layout version reproduce the same result. Save version IDs alongside the recipe.

The `/lab` page shows eight sample profiles (`lib/samples.ts`) as 3 × 3 repeats, with a new-seed button, a line-weight slider, a toggle that outlines tile edges, and checks that counts match and the same seed reproduces the tile. Use it to tune sizes, spacing, and colour rules, and to take screenshots for the presentation. `npm run render:samples` writes the same repeats as PNGs to `assets/samples/`.

Documentation: [SVG repeats](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/pattern), [canvas drawing](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage), [PNG export](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob).

### D. Why this approach?

| Approach | Strength | Decision |
| --- | --- | --- |
| Code composes SVG motifs | Exact drawings, counts, repeat boundaries, and targeted edits | Build this first |
| Image model generates the tile | Richer texture and new visual forms | Defer; prompted composition and seams need checking |
| SVG composition → image-model styling | Controlled starting layout with a richer finish | Later experiment; keep the original SVG and review changed geometry |

Image generation and editing are possible, but model documentation still lists precise composition and consistency as limitations. The recommendation above is an engineering choice for this prototype. [OpenAI image generation guide](https://developers.openai.com/api/docs/guides/image-generation)

## 6. Editing

The result view has edit buttons: **Warmer / Cooler**, **Smaller / Larger**, **Calmer / Busier**, **Shuffle**, and **Undo**. Chat requests do the same through `/api/chat` in edit mode.

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
| Chat + fixed input | Model replies; example answers (rows at the opening, then behind **Show suggestions**); typing indicator; **Create pattern**; fallback chips and retry notice |
| Review | Confirm motifs (off / main / accent), palette, layout, size, and density; badges show “you said”, “suggested”, or “default” |
| Result | Pattern repeat, scarf, recipe card (counts, swatches, settings, reasons), edit buttons, **Download PNG** |
| `/lab` | Sample-recipe gallery for tuning (development only) |

| Endpoint | Input | Output |
| --- | --- | --- |
| `POST /api/chat` (`mode: "interview"`) | Last 12 messages, profile, open topics, question count | Validated extraction, reply, askedTopic, and example answers |
| `POST /api/chat` (`mode: "finish"`) | Last 12 messages, profile, missing topics | Suggestions for the missing choices, a name, and a description |

The `edit` mode arrives in CONVERSATION_PLAN Step 8.

The browser builds the recipe, render plan, title, explanation, and PNG; the server only calls the model. The title comes from the scene (e.g. “Quiet Beach”) and the explanation from the recipe's reasons.

```text
app/page.tsx              renders the studio
app/lab/                  sample-recipe gallery
app/api/chat/route.ts     the only API route: validates input, calls the model, returns its turn
components/studio.tsx     chat or choices form, header, model calls, Create, View panel
components/chat.tsx       transcript, example answers, progress, result cards, fallback notice
components/recipe-panel.tsx  View panel: pattern, scarf, ingredient rows with badges and changes
components/choices.tsx    pickers and badges shared by the form and the View panel
components/review-form.tsx
components/download.ts    PNG download
lib/types.ts
lib/schemas.ts            zod schemas for requests and model output
lib/prompt.ts             system prompt and per-turn state note
lib/model.ts              server-only Claude call (structured output, 15 s limit)
lib/chat-client.ts        browser call to /api/chat
lib/catalogue.ts          motifs, palettes, sizes
lib/motif-paths.ts        generated by npm run trace
lib/samples.ts            sample profiles for /lab and Try sample
lib/design.ts             Create: fill missing choices, build and rebuild designs, result cards
lib/interview.ts          mergeProfile, openTopics, applyModelTurn, templates, chips, keywordExtract
lib/recipe.ts             profileToRecipe, allocateCounts, applyEdit, reasons, patternTitle
lib/render.ts             rng, buildRenderPlan, renderTile, renderRepeat, renderScarf, exportPng
lib/session.ts            localStorage
lib/use-session.ts        React hook for the saved session
```

## 8. Build order

About five hours. Each step ends with something you can check; commit after each one.

### Step 0 — Before the day (only if the rules allow pre-work)

- Put `ANTHROPIC_API_KEY` in `.env.local` (template: `.env.example`), then run `npm run test:claude`. It sends the demo message to Claude and prints the structured extraction (`scripts/test-claude.ts`).
- Sketch or draw the six motifs.

### Step 1 — Scaffold (20 min)

- Create the Next.js app (TypeScript, App Router, Tailwind); add `zod`.
- Write `lib/types.ts` and `lib/catalogue.ts`: the four palettes, three sizes, and the six motifs (traced drawings, or placeholders in the §4 format if the art is not ready).
- **Done when** the dev server runs and types compile.

### Step 2 — Recipe and renderer (50 min)

- Implement `rng`, `allocateCounts`, `profileToRecipe`, `buildRenderPlan`, and `renderTile` (§5).
- Build `/lab` with 6–8 contrasting sample recipes.
- **Done when** counts match the recipe, the 3 × 3 shows no seams, the same recipe and seed reproduce the same tile, and contrasting recipes look clearly different.

### Step 3 — Real artwork (40 min, less if pre-drawn)

- Run the §4 pipeline for all six drawings if not done in Step 0; confirm permitted rotations.
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

### Steps 6–9 — model-led conversation, Create, edits, rehearsal

These steps follow [CONVERSATION_PLAN.md §7](CONVERSATION_PLAN.md#7-build-order-replaces-steps-68), which replaced the original Steps 6–8:

| Step | Build | Budget |
| --- | --- | --- |
| 6 | LLM conversation: `/api/chat`, prompt, model turns, example answers, fallback; tuned with `npm run test:chat` | 60 min |
| 7 | Create and result: finish mode, progress stages, result card, View panel, download | 45 min |
| 8 | Edits: buttons and **Undo**, then chat edits (§6) | 25 min |
| 9 | Check and rehearse | 30 min + 20 min buffer |

| Checkpoint | Target time |
| --- | --- |
| Real artwork in `/lab` | ~1 h 50 |
| App works without AI | ~2 h 30 |
| Keyword chat | ~3 h 10 |
| Model-led chat | ~4 h 10 |
| Create and result card | ~4 h 55 |
| Edits | ~5 h 20 |

**If behind, cut in this order:** chat edits (keep the buttons) → progress stages → model-written name and description (use `patternTitle`) → changes in the View panel (keep **Change choices** and the form). Keep the model conversation; the keyword fallback is its safety net.

**Demo:** Share a scene → answer the model's follow-ups → create → view the recipe → edit → download.

Focus engineering effort on extraction, memory, routing, composition rules, and controlled edits. The six-motif catalogue fits in model context; session memory does not require RAG.

Technical references: [Next.js API routes](https://nextjs.org/docs/app/api-reference/file-conventions/route), [Claude structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).

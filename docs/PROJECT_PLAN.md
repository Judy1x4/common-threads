# Common Threads — project plan

**A chatbot that creates a repeating textile pattern from the user's answers and my original drawings.**

## 1. Project

| Item | Decision |
| --- | --- |
| Track | **Design × Tech** |
| Input | A scene or memory, preferred shapes, colours, arrangement, size, and density |
| Process | Conversation → confirmed profile → design recipe → rendered pattern |
| Output | One pattern, its recipe, a scarf preview, and a downloadable PNG tile |
| My contribution | Six original drawings, conversation logic, and composition rules |
| Inspiration | EveryHuman's conversation-to-perfume interaction |

The project connects my fine-art practice with full-stack engineering. Users choose how their answers appear in the artwork.

## 2. User workflow

| Step | Example | App behaviour |
| --- | --- | --- |
| 1. Chat | “A quiet beach. Mostly small waves, a few circles. Blue and cream.” | Extract the scene, shapes, size, emphasis, and colours |
| 2. Follow-up | “Regularly arranged or scattered?” → “Scattered.” | Ask only about missing choices, one question at a time |
| 3. Review | Waves as the main shape; circles as accents; cool palette; small; spacious; scattered | Let the user correct preferences and accept suggestions/defaults |
| 4. Create | View the textile pattern and scarf preview | Build a recipe and compose the artwork |
| 5. Edit | “Make it denser.” or an edit button | Change that one setting; preserve the rest |
| 6. Download | Save the design | Export a 2048 × 2048 PNG repeat tile |

“Beach” can suggest waves and “quiet” can suggest low density. The user confirms these interpretations before generation.

## 3. How one pattern is made

**Use code to compose SVG drawings into one repeat tile.** Image-model generation is a later option.

| Stage | Implementation |
| --- | --- |
| Recipe | Specify motifs, counts, palette, layout, size, and a random seed |
| Placement | Assign each motif a position, scale, colour, and permitted rotation |
| Visual consistency | Use coordinated drawings, shared colours, consistent line weights, and balanced spacing |
| Repeat | Draw one square tile; draw each motif at all nine tile offsets so opposite edges match; repeat it across the preview |
| Export | Convert the same SVG tile to PNG |

Example recipe: **3 waves + 1 circle, cool palette, small motifs, scattered layout, low density.** The recipe controls the artwork; chat edits change its settings.

Tune sample combinations before connecting the chatbot. This establishes that the drawing library and layouts produce attractive patterns.

## 4. Architecture and scope

| Part | Implementation / limit/examples    |
| --- | --- |
| Web app | Next.js, React, TypeScript; Node.js API routes |
| Text AI | One call per message: extract answers and write a short acknowledgement; interpret edit requests |
| Application code | Track missing answers, word questions from templates, maintain memory, validate choices, create recipes, render artwork |
| Drawing library | Six original SVGs: wave, circle, dot, stripe, arch, leaf; use 1–3 per design |
| Layouts | Regular grid or scattered |
| Palettes | Warm, cool, green, vivid |
| Density / size | 4, 9, or 16 placements; small, medium, or large motifs at fixed sizes, independent of density |
| Memory | Separate chat, profile, and recipe state saved in browser localStorage |
| Interface | Chat, suggestion chips, preference review, result/recipe view, edit buttons, scarf preview, download |
| Deferred | Cultural-reference selection, image-model styling, custom training, RAG, accounts, saved-chats sidebar, model-written questions |

Keep model credentials on the server. Validate structured AI output before applying it. Preserve the session after a failed call and allow retry; include a labelled sample demo. The full flow also works without the model, using the review form, suggestion chips, and keyword matching.

## 5. Build order

| Order | Task | Budget |
| --- | --- | --- |
| 1 | Scaffold; build recipe rules and the renderer with placeholder motifs; tune in a `/lab` gallery | 70 min |
| 2 | Draw and trace the six motifs; tune palettes and spacing in `/lab` | 40 min |
| 3 | Build review, result, scarf preview, and export, so the app works without AI | 40 min |
| 4 | Build question routing, memory, and keyword fallback; then model extraction | 75 min |
| 5 | Add edits: buttons first, then chat | 25 min |
| 6 | Check and rehearse | 30 min |
| 7 | Integration buffer | 20 min |

Detailed steps, checkpoints, and a cut list are in [IMPLEMENTATION_PLAN.md §8](IMPLEMENTATION_PLAN.md#8-build-order).

Use Codex for the interface and implementation support. Focus my effort on artwork, conversation behaviour, and composition rules.

## 6. Completion checks

| Check | Expected result |
| --- | --- |
| Contrasting profiles | Different shapes, arrangements, spacing, and colours |
| Corrections and skips | Accurate profile; no repeated questions or invented answers |
| Review | Suggestions and defaults are visible and editable |
| Recipe / repeat | Motif counts match; 3 × 3 preview has no unintended seams |
| Edits | Requested setting changes; unrelated choices stay stable |
| Export / recovery | PNG matches preview; failed calls preserve the session |
| Without AI | Full flow works with the API key removed |

**Demo:** Chat → review → create → inspect recipe → request one edit → download.

## 7. Application response

I want to build **Common Threads**, a chatbot that creates a personal textile pattern from a short conversation. Users describe a scene or memory and choose shapes, colours, and arrangement. The app turns their confirmed preferences into a pattern using my original drawings. They can edit it through chat and download it. This combines my interests in fine art and full-stack engineering.

# Common Threads

**A chatbot that gets to know someone, builds a profile, and designs one fabric pattern for them.**

Track: Culture × Tech  
Format: Web prototype for a one-day makeathon

## 1. Project idea

Common Threads has a conversation with a person about their background, memories, and visual preferences. It builds a profile from their answers, turns that profile into a design recipe, and creates a custom fabric pattern using selected cultural influences.

The person receives one downloadable pattern, a simple scarf preview, and a short explanation of the design choices. They can request changes through the chat.

**Core flow: Conversation → personal profile → design recipe → finished pattern.**

The experience is inspired by [EveryHuman](https://www.everyhuman.com/us/en): getting to know a person and using their answers to create something personal. Common Threads applies that idea to fabric design.

## 2. Personal motivation

I am a Korean computer science student with full-stack engineering experience who also draws fine art. I want to connect my interests in drawing and art history with my curiosity about Singapore's multicultural life.

This project lets me contribute both original artwork and software. It also gives participants a way to explore the cultural influences and personal experiences they want reflected in a design.

## 3. User experience

### Step 1: Have a conversation

The chatbot asks about the person and follows up on their answers. Aim for four to six short exchanges, adjusting the questions to what they share.

Useful starting questions include:

- What places have shaped you?
- Is there a tradition, object, or memory that feels important to you?
- What kinds of patterns catch your attention?
- What colours do you like, and how should the design feel?

Example conversation:

> Bot: What places have shaped you?  
> User: I grew up in Korea, and I am interested in Singapore's batik.  
> Bot: What attracts you to it—the flowers, the colours, or the arrangement?  
> User: The flowers, but I prefer simple designs.

The bot should follow up on useful details and avoid repeating questions the person has already answered.

### Step 2: Build and show the profile

The profile updates during the conversation. Before generating the pattern, show a short summary that the person can correct.

| Profile field | What it records |
| --- | --- |
| Cultural connections | Background, traditions, and cultures the person says they feel connected to or want to explore |
| Personal associations | Meaningful places, objects, and memories |
| Visual preferences | Colours, shapes, simplicity, detail, and symmetry |
| Desired feeling | How they want the design to feel |

Cultural connections come from the person's own statements. The bot can suggest visual interpretations and let the person revise them.

The profile is ready when there is enough information to choose a supported reference, visual elements, colours, and an overall direction. Ask a focused follow-up when a necessary choice is missing.

### Step 3: Create a design recipe

The design recipe is the equivalent of the perfume formula in the reference experience. It specifies the ingredients and their arrangement.

| Recipe field | Purpose |
| --- | --- |
| Reference IDs | Identify the textile influences used |
| Layout | Choose a supported composition |
| Motif IDs | Select drawings from the artwork library |
| Palette | Select compatible colours |
| Motif scale | Set the size of the drawings |
| Spacing and density | Control how busy or open the pattern looks |
| Reasons | Connect each significant choice to an answer or a researched reference |

For the example above, the recipe could specify a jogakbo-inspired patchwork layout, small floral drawings informed by a selected batik reference, and generous spacing. The bot would ask about colours before completing the recipe.

### Step 4: Render the pattern

The app uses the recipe to compose a repeating pattern from original artwork. Show the complete pattern and a simple scarf mockup.

Include a short explanation, such as:

> You mentioned your Korean upbringing and your interest in floral batik. This design combines a patchwork arrangement with floral drawings. The smaller motifs and open spacing reflect your preference for simple designs.

### Step 5: Refine and download

The person can request a change through the chat:

- Make the flowers smaller.
- Use warmer colours.
- Make it less busy.

Update the relevant recipe settings and render the revised pattern. Offer a PNG download of the repeat tile, alongside the larger preview.

## 4. Textile references and original artwork

Start with two researched references:

- **Korean jogakbo:** use patchwork composition as a layout reference. [V&A reference](https://www.vam.ac.uk/articles/jogakbo-traditional-korean-patchwork)
- **A selected floral batik reference from Java associated with Peranakan dress:** study its floral arrangement. The Peranakan Museum documents north-coast Javanese batik worn by communities in Singapore, Malacca, and Penang. [Peranakan Museum reference](https://www.nhb.gov.sg/peranakanmuseum/galleries/tpmgallerylevel-3/batik)

Prepare approximately six original SVG motifs, two layouts, and several compatible palettes. One layout can use patchwork; the other can use an open repeating arrangement.

Store the catalogue in a small JSON file. Each reference record contains its name, tradition or community, region, sourced description, source URL, and associated assets. Each asset has an ID and compatible layouts.

The prototype can collect a person's full background while generating designs from the supported catalogue. If their interests fall outside the catalogue, introduce the available references and ask which they would like to explore.

Label the output as a contemporary design inspired by the selected references. Explain researched influences separately from personal associations supplied by the user.

## 5. Technical structure

| Component | Responsibility |
| --- | --- |
| Conversation engine | Ask relevant questions and handle follow-up answers |
| Profile builder | Maintain a structured summary of the person's answers |
| Design composer | Select library elements and produce a design recipe |
| Pattern renderer | Arrange the SVG artwork, display previews, and export the repeat tile |

Use an existing language model for the conversation, profile, and recipe. Use application code to render the artwork. Custom model training is outside the one-day scope.

Implementation approach:

- Use my familiar frontend stack for the chat, profile summary, and pattern preview.
- Keep the conversation, profile, and current recipe as separate session objects in browser memory.
- Use a server endpoint for model calls, with operations for conversation, generation, and refinement. Keep credentials on the server.
- Give the model the supported catalogue and require structured profile and recipe outputs.
- Validate reference IDs, motif IDs, layouts, colours, and numerical settings before rendering.
- Generate explanations from the same profile, reference records, and recipe used to draw the pattern.
- Handle edits by updating the current recipe, preserving choices unrelated to the requested change.

If model access fails, preserve the current session and offer retry. A sample profile and recipe provide a fallback demonstration of the pattern generator.

## 6. One-day prototype scope

| Deliverable | Completion target |
| --- | --- |
| Conversation | Short conversation with relevant follow-up questions |
| Profile | A readable summary the person can correct |
| Reference catalogue | Two researched references with source links |
| Artwork | Around six original motifs, two layouts, and several palettes |
| Generation | One pattern visibly shaped by the profile |
| Presentation | Pattern preview, simple scarf mockup, and brief explanation |
| Refinement | Chat edits for colour, motif size, or density |
| Export | Downloadable PNG repeat tile |

If time remains, add another textile reference or bilingual conversation. Complete the core journey before expanding the catalogue.

## 7. Build order and time budget

Allow roughly five hours of focused work, adjusted around onboarding, breaks, and the organiser's presentation schedule.

| Work block | Focus | Result |
| --- | --- | --- |
| 45 minutes | Research references, draw motifs, and define palettes | Small artwork and reference catalogue |
| 60 minutes | Build the renderer from sample recipes | Attractive repeating patterns |
| 75 minutes | Build the chat and profile updates | Conversation that produces a useful profile |
| 45 minutes | Connect recipe generation, refinement, explanation, and export | Complete user journey |
| 45 minutes | Check results, add the simple scarf preview, and rehearse | Demo-ready prototype |
| 30 minutes | Buffer | Time for integration issues |

Build the renderer before connecting the chatbot. This establishes that the available ingredients can produce good designs. Use Codex to help scaffold the interface, implement the renderer, and debug integration issues.

## 8. Quality checks

The main design challenge is making personalisation visible. Answers should change motifs, layout, scale, and spacing as well as colours.

Before the presentation:

- Try three contrasting profiles and check that their results look meaningfully different.
- Check that a follow-up answer updates the profile correctly.
- Check that correcting the profile affects the generated recipe.
- Inspect a 3 × 3 repeat preview for unintended seams.
- Check that an edit changes the requested setting while preserving unrelated choices.
- Confirm that explanations match the rendered pattern and the selected sources.
- Confirm that the PNG matches the preview and that failed model calls preserve the session.

Success means a person can complete the conversation, recognise how their answers affected the design, make a useful change, and download their pattern.

## 9. Presentation

Demonstrate the project in this order:

1. State the idea: a chatbot gets to know you and creates a fabric pattern for you.
2. Show a short conversation and the resulting profile.
3. Generate the pattern and show the scarf preview.
4. Explain two specific connections between the answers and the design.
5. Request one change through the chat and download the result.

## 10. Application response

I want to build **Common Threads**, a chatbot that creates a custom fabric pattern after getting to know someone through conversation. It builds a profile from their cultural background, memories, and visual preferences, then combines design elements from different textile traditions into one pattern. Users can download their design and see how their answers shaped it. As a Korean computer science student who draws fine art, I want to explore Singapore's multicultural influences through both art and technology.

// Checks the conversation logic with keyword matching only (Step 5 "done when").
// Run: npm run check:interview
import { applyModelTurn, addUserMessage, chipsFor, currentTopic, emptyExtraction, keywordExtract, nextStep, oneQuestion, plainWords, takeTurn } from "../lib/interview";
import { addDesign, applyFinish, buildDesign, rebuildDesign, replaceLatestDesign, topicsToSuggest } from "../lib/design";
import { missingChoices, profileToRecipe } from "../lib/recipe";
import { emptySession } from "../lib/session";
import type { Session } from "../lib/types";

let failures = 0;
function check(label: string, condition: boolean, detail?: unknown) {
  console.log(`${condition ? "✓" : "✗"} ${label}${condition || detail === undefined ? "" : `: ${JSON.stringify(detail)}`}`);
  if (!condition) failures++;
}

function say(session: Session, text: string): Session {
  return takeTurn(session, text, keywordExtract(text, currentTopic(session)));
}

const lastReply = (s: Session) => s.messages.at(-1)!.text;

// 1. The demo conversation from the project plan.
console.log("\nDemo conversation");
let s = emptySession();
s = say(s, "A quiet beach. Mostly small waves, a few circles. Blue and cream.");
const p = s.profile;
check("scene from the first sentence", p.scene?.value === "A quiet beach", p.scene);
check("waves main, circles accent (explicit)", JSON.stringify(p.motifs?.value) === '[{"id":"wave","role":"main"},{"id":"circle","role":"accent"}]' && p.motifs?.origin === "explicit", p.motifs);
check("blue and cream → cool (colour words are explicit)", p.paletteId?.value === "cool" && p.paletteId.origin === "explicit", p.paletteId);
check("small motifs (explicit)", p.motifScale?.value === "small" && p.motifScale.origin === "explicit", p.motifScale);
check("quiet → low density (suggested)", p.density?.value === "low" && p.density.origin === "suggested", p.density);
check("asks only the missing arrangement question", currentTopic(s) === "arrangement", lastReply(s));
s = say(s, "Scattered.");
check("scattered layout, then ready to create in the chat", s.profile.layoutId?.value === "scattered" && nextStep(s).kind === "ready" && s.interview.phase === "INTERVIEW", s.interview);
check("ready to create", missingChoices(s.profile).length === 0 && profileToRecipe(s.profile, 1).ingredients.length === 2);
for (const m of s.messages) console.log(`   ${m.role === "user" ? "You" : "Bot"}: ${m.text}`);

// 2. Corrections and precedence.
console.log("\nCorrections");
s = say(emptySession(), "Something by the sea at sunset");
check("sea → wave suggested, sunset → warm suggested", s.profile.motifs?.origin === "suggested" && s.profile.paletteId?.value === "warm" && s.profile.paletteId.origin === "suggested", s.profile);
check("a suggestion alone leaves shapes open", currentTopic(s) === "shapes", s.interview);
s = say(s, "Actually green please, with circles");
check("explicit green replaces suggested warm", s.profile.paletteId?.value === "green" && s.profile.paletteId.origin === "explicit");
check("named circles replace the suggested waves", JSON.stringify(s.profile.motifs?.value) === '[{"id":"circle"}]', s.profile.motifs);
s = say(s, "maybe something like the sea at sunset");
check("a later suggestion does not override explicit choices", s.profile.paletteId?.value === "green" && s.profile.motifs?.value[0].id === "circle");
s = say(s, "use leaves instead of circles");
check("replacement: leaves in, circles excluded", JSON.stringify(s.profile.motifs?.value) === '[{"id":"leaf"}]' && s.profile.excludedIngredientIds.includes("circle"), s.profile);

// 3. Skips, unsupported shapes, and the question limit.
console.log("\nSkips and unsupported shapes");
s = say(emptySession(), "skip");
check("skipping the scene moves on to shapes", s.interview.skippedTopics.includes("scene") && currentTopic(s) === "shapes", s.interview);
s = say(s, "flowers and stars");
check("unsupported shapes get the closest motif", lastReply(s).includes("I don't have flowers yet; the closest is leaves") && lastReply(s).includes("stars"), lastReply(s));
check("closest motifs are suggested, not chosen", s.profile.motifs?.origin === "suggested", s.profile.motifs);

console.log("\nUnclear answers");
s = emptySession();
for (let i = 0; i < 6 && nextStep(s).kind === "ask"; i++) s = say(s, "hmm");
check("unanswered topics are asked at most twice, within six questions", nextStep(s).kind === "ready" && s.interview.questionCount <= 6, s.interview);
check("review shows what is still needed", missingChoices(s.profile).join(",") === "shapes,colours,arrangement");

// 4. Chips set values directly.
console.log("\nChips");
s = emptySession();
const chipTurn = (session: Session, label: string) => {
  const chip = chipsFor(currentTopic(session)!).find((c) => c.label === label)!;
  return takeTurn(session, chip.label, chip.extraction);
};
s = chipTurn(s, "Skip");
s = chipTurn(s, "Arches");
s = chipTurn(s, "Warm");
s = chipTurn(s, "Regular");
s = chipTurn(s, "Large and busy");
check("chips alone reach ready", nextStep(s).kind === "ready" && missingChoices(s.profile).length === 0, s.profile);
check("chip values are explicit", s.profile.density?.value === "high" && s.profile.density.origin === "explicit");

// 5. Model turns: code keeps the model's question only if its topic is still open.
console.log("\nModel turns (no API call)");
const modelTurn = (session: Session, text: string, askedTopic: Parameters<typeof applyModelTurn>[1]["askedTopic"], extraction = {}) => {
  const [withMessage, id] = addUserMessage(session, text);
  const { acknowledgement: _unused, ...base } = emptyExtraction();
  void _unused;
  return applyModelTurn(withMessage, { extraction: { ...base, ...extraction }, reply: "Model reply?", askedTopic, suggestions: ["a", "b", "c", "d"] }, id);
};
s = modelTurn(emptySession(), "a quiet beach", "shapes", { scene: "a quiet beach" });
check("an open topic keeps the model's reply and suggestions", lastReply(s) === "Model reply?" && s.messages.at(-1)!.suggestions?.length === 3 && currentTopic(s) === "shapes", s.messages.at(-1));
s = modelTurn(s, "waves", "shapes", { motifs: [{ id: "wave", role: "equal", origin: "explicit" }] });
check("a topic that is no longer open falls back to the template", lastReply(s).endsWith("What colours would you like?") && currentTopic(s) === "colours", lastReply(s));
s = modelTurn(s, "blue", null, { paletteId: { value: "cool", origin: "explicit" } });
check("'ready' while topics remain falls back to the next question", currentTopic(s) === "arrangement", lastReply(s));
s = modelTurn(s, "I love the colours", "arrangement");
check("an unanswered required topic can be asked a second time", lastReply(s) === "Model reply?" && currentTopic(s) === "arrangement", s.interview);

// Reply guards
console.log("\nReply guards");
check("jargon becomes everyday words", plainWords("A calm palette with small motifs.") === "A calm colour mix with small shapes.");
check("two questions become one (the last)", oneQuestion("Lovely. Is it the sea? What colours do you remember?") === "Lovely. What colours do you remember?", oneQuestion("Lovely. Is it the sea? What colours do you remember?"));
check("one question is left alone", oneQuestion("Long, slow waves, or small ripples?") === "Long, slow waves, or small ripples?");

// 6. Create and View changes (no API call).
console.log("\nCreate and View changes");
s = say(emptySession(), "A quiet beach where I used to walk with my dad");
check("after one answer, Create suggests what is missing (beach already suggested waves)", topicsToSuggest(s.profile).join(",") === "colours,arrangement", topicsToSuggest(s.profile));
const finished = applyFinish(s.profile, {
  ...emptyExtraction(),
  motifs: [{ id: "circle", role: "main", origin: "explicit" }],
  paletteId: { value: "cool", origin: "explicit" },
  layoutId: { value: "scattered", origin: "suggested" },
  density: { value: "high", origin: "suggested" },
}, "m9");
check("finish fills the gaps, marked suggested", !missingChoices(finished).length && finished.paletteId?.origin === "suggested" && finished.motifs?.origin === "suggested", finished);
check("finish never overrides what is already known", finished.density?.value === s.profile.density?.value && finished.scene?.value === s.profile.scene?.value, finished);
let design = buildDesign(finished, 1234, { name: "Morning Shore", description: "Soft waves at dawn." });
s = addDesign(s, finished, design);
check("the card joins the chat with its own snapshot", s.messages.at(-1)!.design?.name === "Morning Shore" && s.design === design);
const warmer = { ...finished, paletteId: { value: "warm" as const, origin: "explicit" as const } };
const changed = rebuildDesign(design, warmer);
check("a View change keeps the seed, name, and other settings", changed.recipe.seed === 1234 && changed.name === "Morning Shore" && changed.recipe.layoutId === design.recipe.layoutId && changed.recipe.density === design.recipe.density && JSON.stringify(changed.recipe.ingredients) === JSON.stringify(design.recipe.ingredients));
check("a palette change moves no motif", JSON.stringify(changed.plan) === JSON.stringify(design.plan));
const firstCard = s.messages.at(-1)!.id;
s = addDesign(s, warmer, buildDesign(warmer, 99));
s = replaceLatestDesign(s, warmer, rebuildDesign(s.design!, { ...warmer, layoutId: { value: "grid", origin: "explicit" } }));
check("View changes update only the latest card", s.messages.find((m) => m.id === firstCard)!.design?.recipe.paletteId === "cool" && s.messages.at(-1)!.design?.recipe.layoutId === "grid");
design = s.design!;
void design;

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);

// Checks the conversation logic with keyword matching only (Step 5 "done when").
// Run: npm run check:interview
import { chipsFor, keywordExtract, takeTurn, currentTopic } from "../lib/interview";
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
check("blue and cream → cool (suggested)", p.paletteId?.value === "cool" && p.paletteId.origin === "suggested", p.paletteId);
check("small motifs (explicit)", p.motifScale?.value === "small" && p.motifScale.origin === "explicit", p.motifScale);
check("quiet → low density (suggested)", p.density?.value === "low" && p.density.origin === "suggested", p.density);
check("asks only the missing arrangement question", currentTopic(s) === "arrangement", lastReply(s));
s = say(s, "Scattered.");
check("scattered layout, then review", s.profile.layoutId?.value === "scattered" && s.interview.phase === "REVIEW", s.interview);
check("ready to create", missingChoices(s.profile).length === 0 && profileToRecipe(s.profile, 1).ingredients.length === 2);
for (const m of s.messages) console.log(`   ${m.role === "user" ? "You" : "Bot"}: ${m.text}`);

// 2. Corrections and precedence.
console.log("\nCorrections");
s = say(emptySession(), "Something by the sea, in blue");
check("sea → wave suggested, blue → cool suggested", s.profile.motifs?.origin === "suggested" && s.profile.paletteId?.origin === "suggested", s.profile);
s = say(s, "Actually green please, with circles");
check("explicit green replaces suggested cool", s.profile.paletteId?.value === "green" && s.profile.paletteId.origin === "explicit");
check("named circles replace the suggested waves", JSON.stringify(s.profile.motifs?.value) === '[{"id":"circle"}]', s.profile.motifs);
s = say(s, "maybe something blue and watery");
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
for (let i = 0; i < 6 && s.interview.phase === "INTERVIEW"; i++) s = say(s, "hmm");
check("each topic is asked once, then review", s.interview.phase === "REVIEW" && s.interview.questionCount <= 6, s.interview);
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
check("chips alone reach review", s.interview.phase === "REVIEW" && missingChoices(s.profile).length === 0, s.profile);
check("chip values are explicit", s.profile.density?.value === "high" && s.profile.density.origin === "explicit");

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);

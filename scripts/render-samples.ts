// Render each sample profile as a 3 × 3 repeat PNG, to check the renderer
// outside the browser or grab images for slides.
// Run: npm run render:samples [-- output-dir] [--edges]   (default: assets/samples)
import { mkdirSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { profileToRecipe } from "../lib/recipe";
import { buildRenderPlan, renderRepeat } from "../lib/render";
import { SAMPLES } from "../lib/samples";

const out = process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? "assets/samples";
mkdirSync(out, { recursive: true });

for (const sample of SAMPLES) {
  const recipe = profileToRecipe(sample.profile, sample.seed);
  const svg = renderRepeat(recipe, buildRenderPlan(recipe), { showTileEdges: process.argv.includes("--edges") });
  writeFileSync(`${out}/${sample.id}.png`, new Resvg(svg, { fitTo: { mode: "width", value: 1536 } }).render().asPng());
  console.log(`${sample.id}: ${recipe.ingredients.map((i) => `${i.id}×${i.count}`).join(" ")}`);
}
console.log(`Wrote ${SAMPLES.length} PNGs to ${out}/`);

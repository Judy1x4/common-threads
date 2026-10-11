import { exportPng } from "@/lib/render";
import type { Design } from "@/lib/types";

// Save the design's 2048 × 2048 tile as a PNG named after the pattern.
export async function downloadDesign(design: Design): Promise<void> {
  const url = URL.createObjectURL(await exportPng(design.recipe, design.plan));
  const link = document.createElement("a");
  link.href = url;
  link.download = `common-threads-${design.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Recipe → render plan → SVG (docs/IMPLEMENTATION_PLAN.md §5B and §5C).
import { MOTIF_BOX, MOTIF_SIZES, MOTIFS, PALETTES, TILE_SIZE } from "./catalogue";
import type { MotifId, Placement, Recipe, RenderPlan } from "./types";

type Point = [x: number, y: number];

const SCATTER_CANDIDATES = 40;
// Extra same-colour stroke, in tile pixels, that thickens the thin hand-drawn lines.
export const DEFAULT_LINE_WEIGHT = 3;

const round = (n: number) => Math.round(n * 10) / 10;

// Seeded random numbers in [0, 1) (mulberry32), so a recipe's seed reproduces its tile.
export function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function gridPositions(count: number): Point[] {
  const perRow = Math.round(Math.sqrt(count));
  const cell = TILE_SIZE / perRow;
  return Array.from({ length: count }, (_, i): Point => [((i % perRow) + 0.5) * cell, (Math.floor(i / perRow) + 0.5) * cell]);
}

// Distance on the repeating tile: measured across the nearest edge if that is shorter.
function wrappedDistance([x1, y1]: Point, [x2, y2]: Point): number {
  const dx = Math.abs(x1 - x2);
  const dy = Math.abs(y1 - y2);
  return Math.hypot(Math.min(dx, TILE_SIZE - dx), Math.min(dy, TILE_SIZE - dy));
}

// Order points so each one is as far as possible from those before it. Any
// prefix of the result is evenly spread; random tie-breaks vary it by seed.
function spreadOrder(points: Point[], random: () => number): Point[] {
  const remaining = shuffle(points, random);
  const ordered = remaining.splice(0, 1);
  while (remaining.length) {
    let bestIndex = 0;
    let bestDistance = -1;
    remaining.forEach((p, i) => {
      const distance = Math.min(...ordered.map((q) => wrappedDistance(p, q)));
      if (distance > bestDistance) {
        bestIndex = i;
        bestDistance = distance;
      }
    });
    ordered.push(...remaining.splice(bestIndex, 1));
  }
  return ordered;
}

// Best-candidate sampling: each point is the farthest of several random tries
// from the points already placed, which gives even but irregular spacing and
// returns the points already in spread order.
function scatteredPositions(count: number, random: () => number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    let best: Point = [0, 0];
    let bestDistance = -1;
    for (let k = 0; k < SCATTER_CANDIDATES; k++) {
      const candidate: Point = [random() * TILE_SIZE, random() * TILE_SIZE];
      const distance = Math.min(Infinity, ...points.map((p) => wrappedDistance(p, candidate)));
      if (distance > bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    points.push(best);
  }
  return points;
}

function pickRotation(id: MotifId, random: () => number): number {
  const allowed = MOTIFS[id].rotations;
  return allowed === "any" ? Math.round(random() * 360) : allowed[Math.floor(random() * allowed.length)];
}

export function buildRenderPlan(recipe: Recipe): RenderPlan {
  const random = rng(recipe.seed);
  const total = recipe.ingredients.reduce((sum, ing) => sum + ing.count, 0);
  const positions =
    recipe.layoutId === "grid" ? spreadOrder(gridPositions(total), random) : scatteredPositions(total, random);

  // Positions are in spread order, so the rarest motifs go first and end up
  // evenly spaced instead of clustered; the most common motif fills the rest.
  const items = [...recipe.ingredients]
    .sort((a, b) => a.count - b.count)
    .flatMap((ing) => Array<MotifId>(ing.count).fill(ing.id));

  // The main motif, then the most frequent, gets the strongest colour. A lone
  // motif splits between the two strongest: first half of the spread order, then the rest.
  const byProminence = [...recipe.ingredients].sort(
    (a, b) => Number(b.role === "main") - Number(a.role === "main") || b.count - a.count,
  );
  const single = byProminence.length === 1;

  return items.map((motifId, i) => ({
    motifId,
    x: round(positions[i][0]),
    y: round(positions[i][1]),
    rotation: pickRotation(motifId, random),
    colorRank: (single ? (i < total / 2 ? 1 : 2) : byProminence.findIndex((ing) => ing.id === motifId) + 1) as Placement["colorRank"],
  }));
}

type RenderOptions = { lineWeight?: number };

// Motif definitions plus every placement drawn at all nine offsets, so a motif
// crossing one edge reappears on the opposite edge and the tile repeats seamlessly.
function tileMotifs(recipe: Recipe, plan: RenderPlan, lineWeight: number) {
  const scale = MOTIF_SIZES[recipe.motifScale] / MOTIF_BOX;
  const colors = PALETTES[recipe.paletteId].colors;
  const centre = -MOTIF_BOX / 2;

  const defs = [...new Set(plan.map((p) => p.motifId))]
    .map(
      (id) =>
        `<path id="m-${id}" d="${MOTIFS[id].path}" transform="translate(${centre} ${centre})" fill="currentColor" fill-rule="evenodd" stroke="currentColor" stroke-width="${round(lineWeight / scale)}" stroke-linejoin="round"/>`,
    )
    .join("");

  const offsets = [-TILE_SIZE, 0, TILE_SIZE];
  const body = plan
    .flatMap((p) =>
      offsets.flatMap((dx) =>
        offsets.map(
          (dy) =>
            `<use href="#m-${p.motifId}" transform="translate(${round(p.x + dx)} ${round(p.y + dy)}) rotate(${p.rotation}) scale(${scale})" color="${colors[p.colorRank]}"/>`,
        ),
      ),
    )
    .join("");

  return { defs, body, background: colors[0] };
}

// One self-contained 512 × 512 tile: the unit that repeats and is exported as
// PNG. `size` sets the output pixel size; the drawing is the same.
export function renderTile(recipe: Recipe, plan: RenderPlan, options: RenderOptions & { size?: number } = {}): string {
  const { defs, body, background } = tileMotifs(recipe, plan, options.lineWeight ?? DEFAULT_LINE_WEIGHT);
  const size = options.size ?? TILE_SIZE;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${TILE_SIZE} ${TILE_SIZE}"><defs>${defs}</defs><rect width="${TILE_SIZE}" height="${TILE_SIZE}" fill="${background}"/>${body}</svg>`;
}

// The tile repeated cols × rows times in one vector image. One shared background
// and identical overlapping copies avoid the hairline seams of repeated bitmaps.
export function renderRepeat(
  recipe: Recipe,
  plan: RenderPlan,
  options: RenderOptions & { cols?: number; rows?: number; showTileEdges?: boolean } = {},
): string {
  const { cols = 3, rows = 3 } = options;
  const { defs, body, background } = tileMotifs(recipe, plan, options.lineWeight ?? DEFAULT_LINE_WEIGHT);
  const width = cols * TILE_SIZE;
  const height = rows * TILE_SIZE;

  let tiles = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) tiles += `<use href="#tile" x="${c * TILE_SIZE}" y="${r * TILE_SIZE}"/>`;
  }

  let edges = "";
  if (options.showTileEdges) {
    const lines = [
      ...Array.from({ length: cols - 1 }, (_, i) => `M${(i + 1) * TILE_SIZE} 0V${height}`),
      ...Array.from({ length: rows - 1 }, (_, i) => `M0 ${(i + 1) * TILE_SIZE}H${width}`),
    ];
    edges = `<path d="${lines.join("")}" fill="none" stroke="#d22" stroke-width="3" stroke-dasharray="12 10"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs}<g id="tile">${body}</g></defs><rect width="${width}" height="${height}" fill="${background}"/>${tiles}${edges}</svg>`;
}

// A simple scarf mockup: the tile as an SVG pattern on a softly draped scarf
// with fringed ends and fold shading.
export function renderScarf(recipe: Recipe, plan: RenderPlan, options: RenderOptions = {}): string {
  const { defs, body, background } = tileMotifs(recipe, plan, options.lineWeight ?? DEFAULT_LINE_WEIGHT);
  const fringeColor = PALETTES[recipe.paletteId].colors[1];
  const tileScale = 150 / TILE_SIZE; // about two tiles across the scarf
  const outline = "M60 60C52 320 72 620 58 880L302 880C288 620 308 320 300 60Z";

  let fringe = "";
  for (let x = 64, i = 0; x <= 296; x += 8, i++) {
    const sway = ((i % 3) - 1) * 2;
    fringe += `M${x} 60L${x + sway} 22M${x} 880L${x - sway} 922`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="960" viewBox="0 0 360 960"><defs>${defs}<pattern id="cloth" patternUnits="userSpaceOnUse" width="${TILE_SIZE}" height="${TILE_SIZE}" patternTransform="scale(${round(tileScale * 1000) / 1000})"><rect width="${TILE_SIZE}" height="${TILE_SIZE}" fill="${background}"/>${body}</pattern><linearGradient id="folds" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0.14"/><stop offset="0.2" stop-color="#000" stop-opacity="0"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.12"/><stop offset="0.7" stop-color="#000" stop-opacity="0.07"/><stop offset="1" stop-color="#000" stop-opacity="0.16"/></linearGradient><filter id="shadow" x="-20%" y="-10%" width="140%" height="120%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-opacity="0.18"/></filter></defs><path d="${fringe}" stroke="${fringeColor}" stroke-width="2.5" stroke-linecap="round" opacity="0.85"/><g filter="url(#shadow)"><path d="${outline}" fill="url(#cloth)"/></g><path d="${outline}" fill="url(#folds)"/></svg>`;
}

// Render the tile at 2048 × 2048 in the browser and return it as a PNG.
export async function exportPng(recipe: Recipe, plan: RenderPlan, size = 2048): Promise<Blob> {
  const image = new Image();
  image.src = svgDataUrl(renderTile(recipe, plan, { size }));
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  canvas.getContext("2d")?.drawImage(image, 0, 0, size, size);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed"))), "image/png"),
  );
}

// For <img src> and downloads; keeps each SVG's ids isolated from the page.
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

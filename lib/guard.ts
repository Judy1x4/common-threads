// Server-only safeguards for /api/chat on a public link (docs/HOSTING_PLAN.md §2).
// Both are off by default when running locally without the variables.

const WINDOW_MS = 10 * 60_000;
// Calls per client IP per 10 minutes. A conversation with Create is about 7
// calls; a venue's shared Wi-Fi IP may need a higher value.
const limit = () => Number(process.env.RATE_LIMIT_PER_10_MIN) || 60;

// Each server instance keeps its own counts, so this slows casual abuse rather
// than stopping a determined attacker; the Console spend limit is the backstop.
const calls = new Map<string, number[]>();

export function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "local";
}

export function withinRateLimit(key: string, now = Date.now()): boolean {
  const recent = (calls.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  const allowed = recent.length < limit();
  if (allowed) recent.push(now);
  calls.set(key, recent);
  if (calls.size > 10_000) {
    for (const [k, times] of calls) if (!times.some((t) => now - t < WINDOW_MS)) calls.delete(k);
  }
  return allowed;
}

// When DEMO_ACCESS_CODE is set, only requests carrying it reach the model;
// everyone else gets the app with keyword replies.
export function hasAccess(request: Request): boolean {
  const code = process.env.DEMO_ACCESS_CODE;
  return !code || request.headers.get("x-access-code") === code;
}

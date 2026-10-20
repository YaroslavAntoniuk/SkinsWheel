import type { Rng } from "./rng";
import type { Skin, Wear } from "./types";

// The game rolls a raw float first, remaps it into the skin's range, and only
// then names the wear. Picking the wear first (what the MVP did) produces
// impossible items such as a Factory New Asiimov.

/**
 * Community-measured drop distribution of the raw float (SteamDashboard case
 * odds; cross-checked with WeCoach / CSGOSKINS.GG). Valve does not publish it.
 * Uniform inside each band.
 */
export const DROP_BANDS: readonly { from: number; to: number; weight: number }[] = [
  { from: 0, to: 0.07, weight: 0.03 },
  { from: 0.07, to: 0.15, weight: 0.24 },
  { from: 0.15, to: 0.38, weight: 0.33 },
  { from: 0.38, to: 0.45, weight: 0.24 },
  { from: 0.45, to: 1, weight: 0.16 },
];

export const WEARS: readonly { wear: Wear; from: number; to: number }[] = [
  { wear: "Factory New", from: 0, to: 0.07 },
  { wear: "Minimal Wear", from: 0.07, to: 0.15 },
  { wear: "Field-Tested", from: 0.15, to: 0.38 },
  { wear: "Well-Worn", from: 0.38, to: 0.45 },
  { wear: "Battle-Scarred", from: 0.45, to: 1 },
];

/** Raw float in [0, 1) drawn from DROP_BANDS. */
export function rollRawFloat(rng: Rng): number {
  let r = rng();
  for (const band of DROP_BANDS) {
    if (r < band.weight) return band.from + (r / band.weight) * (band.to - band.from);
    r -= band.weight;
  }
  // Only reachable through floating-point slack in the weights' sum.
  const last = DROP_BANDS[DROP_BANDS.length - 1]!;
  return last.from + rng() * (last.to - last.from);
}

/** float = minFloat + raw × (maxFloat − minFloat), stored as float32 like the game. */
export function remapFloat(raw: number, minFloat: number, maxFloat: number): number {
  return Math.fround(minFloat + raw * (maxFloat - minFloat));
}

export function wearOf(float: number): Wear {
  for (const w of WEARS) if (float < w.to) return w.wear;
  return "Battle-Scarred";
}

/** CDF of the raw drop distribution at x ∈ [0, 1]. */
function rawCdf(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let total = 0;
  for (const band of DROP_BANDS) {
    if (x >= band.to) total += band.weight;
    else {
      if (x > band.from) total += band.weight * ((x - band.from) / (band.to - band.from));
      break;
    }
  }
  return total;
}

/**
 * Exact probability of each wear for this skin, accounting for its float
 * range. Impossible wears are 0 and are left off the wear wheel.
 */
export function wearOdds(skin: Pick<Skin, "minFloat" | "maxFloat">): Map<Wear, number> {
  const odds = new Map<Wear, number>();
  const { minFloat: min, maxFloat: max } = skin;
  if (min === null || max === null || max <= min) return odds;
  for (const w of WEARS) {
    // The raw values that land inside [w.from, w.to) after the remap.
    const p = rawCdf((w.to - min) / (max - min)) - rawCdf((w.from - min) / (max - min));
    if (p > 0) odds.set(w.wear, p);
  }
  return odds;
}

/** Formats a float for the wheel (4 places) or the result card (9 places). */
export function formatFloat(float: number, places: 4 | 9): string {
  return float.toFixed(places);
}

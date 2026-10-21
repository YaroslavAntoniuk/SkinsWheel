import { seedMax } from "./roll";
import type { Skin } from "./types";

// Seed → pattern quality, from computed tables in patterns/*.json (see
// scripts/sync-patterns.ts). A skin gets a pattern wheel only when a table
// exists for its exact weapon and finish; an inaccurate wheel is worse than none.

export interface FadeFile {
  source: string;
  commit: string;
  license: string;
  /** finish → weapon id → fade % per seed (index = seed). */
  finishes: Record<string, Record<string, number[]>>;
}

export interface BlueFile {
  source: string;
  commit: string;
  license: string;
  /** finish → weapon id → blue / gold % per seed on the side that is judged. */
  finishes: Record<string, Record<string, { side: "top" | "playside"; blue: number[]; gold: number[] }>>;
}

export interface PatternData {
  fade?: FadeFile;
  blue?: BlueFile;
}

export interface PatternTier {
  label: string;
  color: string;
  /** Seeds in this tier; its share of the 1001 seeds is its chance. */
  seeds: number[];
}

export interface PatternWheel {
  /** What the tiers measure, for the wheel's title. */
  metric: string;
  tiers: PatternTier[];
  /** Index into `tiers` for a seed. */
  tierOf(seed: number): number;
  /** One line for the result, e.g. "#661 · 97.6% синього". */
  describe(seed: number): string;
}

interface Band {
  min: number;
  label: string;
  color: string;
}

// Highest band first; a value falls in the first band whose min it reaches.
const FADE_BANDS: readonly Band[] = [
  { min: 99, label: "99–100%", color: "#ff4fa3" },
  { min: 97, label: "97–99%", color: "#e05bd0" },
  { min: 94, label: "94–97%", color: "#a35be0" },
  { min: 90, label: "90–94%", color: "#6a5be0" },
  { min: 0, label: "80–90%", color: "#4b5563" },
];

const BLUE_BANDS: readonly Band[] = [
  { min: 90, label: "Blue Gem 90%+", color: "#1d6cf2" },
  { min: 75, label: "75–90%", color: "#3d86f5" },
  { min: 50, label: "50–75%", color: "#5f8fb8" },
  { min: 25, label: "25–50%", color: "#8a7d4f" },
  { min: 0, label: "<25%", color: "#c9a227" },
];

function banded(
  metric: string,
  skin: Skin,
  table: number[],
  bands: readonly Band[],
  describe: (seed: number) => string,
): PatternWheel {
  // Only seeds this skin can actually roll count toward a tier's chance.
  const reachable = seedMax(skin) + 1;
  if (table.length < reachable) throw new Error(`${skin.name}: pattern table has ${table.length} seeds, need ${reachable}`);
  const values = table.slice(0, reachable);
  const bandOf = (v: number) => bands.findIndex((b) => v >= b.min);
  const tiers = bands.map((b) => ({ label: b.label, color: b.color, seeds: [] as number[] }));
  values.forEach((v, seed) => tiers[bandOf(v)]!.seeds.push(seed));
  // Bands nobody can land in are left off the wheel.
  const kept = tiers.filter((t) => t.seeds.length > 0);
  return {
    metric,
    tiers: kept,
    tierOf: (seed) => kept.findIndex((t) => t.seeds.includes(seed)),
    describe,
  };
}

export function patternWheel(skin: Skin, data: PatternData): PatternWheel | null {
  if (skin.finish === null) return null;

  const fade = data.fade?.finishes[skin.finish]?.[skin.weapon];
  if (fade) {
    const name = skin.finish;
    return banded(`${name} %`, skin, fade, FADE_BANDS, (seed) => `#${seed} · ${name} ${fade[seed]!.toFixed(1)}%`);
  }

  const blue = data.blue?.finishes[skin.finish]?.[skin.weapon];
  if (blue) {
    const side = blue.side === "top" ? "зверху" : "з лицьового боку";
    return banded(
      `% синього ${side}`,
      skin,
      blue.blue,
      BLUE_BANDS,
      (seed) => `#${seed} · ${blue.blue[seed]!.toFixed(1)}% синього, ${blue.gold[seed]!.toFixed(1)}% золота ${side}`,
    );
  }

  return null;
}

/** Problems with the pattern tables against the skin data; empty means valid. */
export function validatePatterns(skins: readonly Skin[], data: PatternData): string[] {
  const errors: string[] = [];
  const check = (kind: string, finish: string, weapon: string, values: number[], min: number, max: number) => {
    const skin = skins.find((s) => s.weapon === weapon && s.finish === finish);
    const where = `${kind} ${weapon} | ${finish}`;
    if (!skin) {
      errors.push(`${where}: no such skin in the data`);
      return;
    }
    if (values.length < seedMax(skin) + 1) errors.push(`${where}: ${values.length} seeds, need ${seedMax(skin) + 1}`);
    const bad = values.findIndex((v) => !(v >= min && v <= max));
    if (bad !== -1) errors.push(`${where}: seed ${bad} = ${values[bad]} outside ${min}–${max}`);
  };
  for (const [finish, byWeapon] of Object.entries(data.fade?.finishes ?? {})) {
    for (const [weapon, values] of Object.entries(byWeapon)) check("fade", finish, weapon, values, 80, 100);
  }
  for (const [finish, byWeapon] of Object.entries(data.blue?.finishes ?? {})) {
    for (const [weapon, t] of Object.entries(byWeapon)) {
      check("blue", finish, weapon, t.blue, 0, 100);
      check("gold", finish, weapon, t.gold, 0, 100);
    }
  }
  return errors;
}

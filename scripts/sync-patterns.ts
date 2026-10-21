// Pulls seed → pattern tables at pinned commits and writes patterns/*.json.
// Only computed, reproducible sources are used; finishes without one (Marble
// Fade, Crimson Web, Tiger Tooth, Slaughter) get no pattern wheel.
//
//   pnpm sync-patterns

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SEED_MAX } from "../src/engine/roll";
import type { Skin } from "../src/engine/types";
import type { BlueFile, FadeFile } from "../src/engine/patterns";

const ROOT = join(import.meta.dirname, "..");
const SEEDS = SEED_MAX + 1;

const FADE_REPO = "https://github.com/chescos/csgo-fade-percentage-calculator";
const BLUE_REPO = "https://github.com/chescos/csgo-blue-gem-calculator";

/** Fade files in the source repo, keyed by our finish name. */
const FADE_FILES: Readonly<Record<string, string>> = {
  Fade: "generated/fade-percentages.json",
  "Amber Fade": "generated/amber-fade-percentages.json",
  "Acid Fade": "generated/acid-fade-percentages.json",
};

/** Item keys of csgo-blue-gem-calculator (gen/items.ts) → display weapon name. */
const BLUE_ITEMS: Readonly<Record<string, string>> = {
  ak47: "AK-47",
  bayonet: "Bayonet",
  bowie: "Bowie Knife",
  butterfly: "Butterfly Knife",
  classic: "Classic Knife",
  deagle: "Desert Eagle",
  falchion: "Falchion Knife",
  fiveseven: "Five-SeveN",
  flip: "Flip Knife",
  gut: "Gut Knife",
  huntsman: "Huntsman Knife",
  karambit: "Karambit",
  kukri: "Kukri Knife",
  m9_bayonet: "M9 Bayonet",
  mac10: "MAC-10",
  navaja: "Navaja Knife",
  nomad: "Nomad Knife",
  paracord: "Paracord Knife",
  shadow: "Shadow Daggers",
  skeleton: "Skeleton Knife",
  stiletto: "Stiletto Knife",
  survival: "Survival Knife",
  talon: "Talon Knife",
  ursus: "Ursus Knife",
};

const BLUE_FINISHES: Readonly<Record<string, string>> = { ch: "Case Hardened", ht: "Heat Treated" };

function headSha(repo: string): string {
  const out = execFileSync("git", ["ls-remote", repo, "HEAD"], { encoding: "utf8" });
  const sha = out.split(/\s/)[0];
  if (!sha || !/^[0-9a-f]{40}$/.test(sha)) throw new Error(`could not resolve ${repo} HEAD: ${out}`);
  return sha;
}

async function fetchJson<T>(repo: string, sha: string, path: string): Promise<T> {
  const url = `${repo.replace("https://github.com/", "https://raw.githubusercontent.com/")}/${sha}/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

async function main(): Promise<void> {
  const skins: Skin[] = JSON.parse(readFileSync(join(ROOT, "data", "skins.json"), "utf8"));
  /** Weapon id for a display name, only where the data has that finish on it. */
  const weaponFor = (weaponName: string, finish: string): string => {
    const skin = skins.find((s) => s.weaponName === weaponName && s.finish === finish);
    if (!skin) throw new Error(`no ${weaponName} | ${finish} in data/skins.json`);
    return skin.weapon;
  };

  // Fade, Amber Fade, Acid Fade: % per seed from the open rotation algorithm.
  const fadeSha = headSha(FADE_REPO);
  const fade: FadeFile = { source: FADE_REPO, commit: fadeSha, license: "MIT", finishes: {} };
  for (const [finish, path] of Object.entries(FADE_FILES)) {
    const rows = await fetchJson<{ weapon: string; percentages: { seed: number; percentage: number }[] }[]>(
      FADE_REPO,
      fadeSha,
      path,
    );
    const table: Record<string, number[]> = {};
    for (const row of rows) {
      // Knives stop at seed 999 (no trade-ups); everything else runs to 1000.
      const weapon = weaponFor(row.weapon, finish);
      const count = row.percentages.length;
      const values = row.percentages.map((p, i) => {
        if (p.seed !== i) throw new Error(`${finish} ${row.weapon}: seed ${p.seed} at index ${i}`);
        return round2(p.percentage);
      });
      if (count !== SEEDS && count !== SEEDS - 1) throw new Error(`${finish} ${row.weapon}: ${count} seeds`);
      table[weapon] = values;
    }
    fade.finishes[finish] = table;
  }

  // Case Hardened, Heat Treated: blue / gold % per seed on the side people judge.
  const blueSha = headSha(BLUE_REPO);
  const raw = await fetchJson<Record<string, Record<string, Record<string, number[]>>>>(
    BLUE_REPO,
    blueSha,
    "gen/result.json",
  );
  const blue: BlueFile = { source: BLUE_REPO, commit: blueSha, license: "MIT", finishes: {} };
  for (const [key, byFinish] of Object.entries(raw)) {
    const weaponName = BLUE_ITEMS[key];
    if (!weaponName) throw new Error(`unknown blue-gem item ${key}`);
    for (const [finishKey, regions] of Object.entries(byFinish)) {
      const finish = BLUE_FINISHES[finishKey];
      if (!finish) throw new Error(`unknown blue-gem finish ${finishKey}`);
      // AK-47 is judged by the top of the gun, everything else by the play side.
      const side = "top" in regions ? "top" : "playside";
      // Flat [blue, purple, gold, other] × 1001 seeds.
      const flat = regions[side];
      if (!flat || flat.length !== SEEDS * 4) throw new Error(`${key} ${finishKey} ${side}: bad length`);
      blue.finishes[finish] ??= {};
      blue.finishes[finish][weaponFor(weaponName, finish)] = {
        side,
        blue: Array.from({ length: SEEDS }, (_, s) => flat[s * 4]!),
        gold: Array.from({ length: SEEDS }, (_, s) => flat[s * 4 + 2]!),
      };
    }
  }

  writeFileSync(join(ROOT, "patterns", "fade.json"), JSON.stringify(fade) + "\n");
  writeFileSync(join(ROOT, "patterns", "blue.json"), JSON.stringify(blue) + "\n");
  for (const [finish, t] of [...Object.entries(fade.finishes), ...Object.entries(blue.finishes)]) {
    console.log(`${finish}: ${Object.keys(t).length} weapons`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

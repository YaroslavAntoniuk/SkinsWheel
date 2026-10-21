import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SlotRun } from "../src/engine/loadout";
import { patternWheel, validatePatterns, type PatternData } from "../src/engine/patterns";
import { createRng } from "../src/engine/rng";
import { seedMax } from "../src/engine/roll";
import type { Skin } from "../src/engine/types";

const root = join(import.meta.dirname, "..");
const readJson = (...path: string[]) => JSON.parse(readFileSync(join(root, ...path), "utf8"));
const skins: Skin[] = readJson("data", "skins.json");
const data: PatternData = { fade: readJson("patterns", "fade.json"), blue: readJson("patterns", "blue.json") };

const find = (weaponName: string, finish: string) =>
  skins.find((s) => s.weaponName === weaponName && s.finish === finish)!;

const tierLabel = (skin: Skin, seed: number) => {
  const wheel = patternWheel(skin, data)!;
  return wheel.tiers[wheel.tierOf(seed)]!.label;
};

describe("pattern tables", () => {
  it("match the skin data and stay in range", () => {
    expect(validatePatterns(skins, data)).toEqual([]);
  });

  it("flag a table for a skin that does not exist, a short table, and out-of-range values", () => {
    const bad: PatternData = {
      fade: { source: "", commit: "", license: "", finishes: { Fade: { weapon_ak47: [90], weapon_awp: new Array(1001).fill(50) } } },
    };
    const errors = validatePatterns(skins, bad).join("\n");
    expect(errors).toMatch(/weapon_ak47 \| Fade: no such skin/);
    expect(errors).toMatch(/weapon_awp \| Fade: seed 0 = 50 outside 80–100/);
    const short: PatternData = { fade: { source: "", commit: "", license: "", finishes: { Fade: { weapon_awp: [90] } } } };
    expect(validatePatterns(skins, short).join()).toMatch(/1 seeds, need 1001/);
  });
});

describe("Case Hardened", () => {
  // Tier-1 blue gems as listed by SteamDB and csdb.gg, checked against the computed table.
  it.each([661, 151, 955, 321, 387, 670, 179])("AK-47 #%i is a Blue Gem", (seed) => {
    expect(tierLabel(find("AK-47", "Case Hardened"), seed)).toBe("Blue Gem 90%+");
  });

  it.each([387, 442, 269, 853, 776, 73])("Karambit #%i is a Blue Gem", (seed) => {
    expect(tierLabel(find("Karambit", "Case Hardened"), seed)).toBe("Blue Gem 90%+");
  });

  it("describes the seed with its blue and gold share", () => {
    expect(patternWheel(find("AK-47", "Case Hardened"), data)!.describe(661)).toBe(
      "#661 · 97.6% синього, 0.0% золота зверху",
    );
  });

  it("Blue Gems are rare: under 2% of AK-47 seeds", () => {
    const wheel = patternWheel(find("AK-47", "Case Hardened"), data)!;
    expect(wheel.tiers[0]!.label).toBe("Blue Gem 90%+");
    expect(wheel.tiers[0]!.seeds.length / 1001).toBeLessThan(0.02);
  });
});

describe("Fade", () => {
  it("Karambit #412 is 100%, #763 is the 80% floor, and knives stop at seed 999", () => {
    const karambit = find("Karambit", "Fade");
    expect(seedMax(karambit)).toBe(999);
    expect(tierLabel(karambit, 412)).toBe("99–100%");
    expect(patternWheel(karambit, data)!.describe(412)).toBe("#412 · Fade 100.0%");
    expect(tierLabel(karambit, 763)).toBe("80–90%");
    const seeds = patternWheel(karambit, data)!.tiers.reduce((n, t) => n + t.seeds.length, 0);
    expect(seeds).toBe(1000);
  });

  it("guns keep seed 1000", () => {
    const glock = find("Glock-18", "Fade");
    expect(seedMax(glock)).toBe(1000);
    expect(patternWheel(glock, data)!.tiers.reduce((n, t) => n + t.seeds.length, 0)).toBe(1001);
  });

  it("covers Amber Fade and Acid Fade", () => {
    expect(patternWheel(find("AUG", "Amber Fade"), data)).not.toBeNull();
    expect(patternWheel(find("SSG 08", "Acid Fade"), data)!.describe(0)).toMatch(/^#0 · Acid Fade \d+\.\d%$/);
  });
});

describe("no table, no wheel", () => {
  it.each([
    ["Karambit", "Marble Fade"],
    ["Karambit", "Crimson Web"],
    ["Karambit", "Tiger Tooth"],
    ["Specialist Gloves", "Fade"],
    ["Hydra Gloves", "Case Hardened"],
    ["AK-47", "Redline"],
  ])("%s | %s", (weapon, finish) => {
    expect(patternWheel(find(weapon, finish), data)).toBeNull();
  });

  it("vanilla knives", () => {
    expect(patternWheel(skins.find((s) => s.finish === null)!, data)).toBeNull();
  });
});

describe("pattern stage", () => {
  it("comes after wear and lands on the tier holding the rolled seed", () => {
    for (let i = 0; i < 200; i++) {
      const run = new SlotRun("weapon_ak47", skins, createRng(`p${i}`), data);
      const kinds: string[] = [];
      let landed: string | null = null;
      while (run.stage) {
        const stage = run.stage;
        const index = run.spin();
        kinds.push(stage.kind);
        if (stage.kind === "pattern") landed = stage.options[index]!.label;
      }
      const { skin, roll, pattern } = run.result!;
      const wheel = patternWheel(skin, data);
      if (!wheel) {
        expect(kinds).not.toContain("pattern");
        expect(pattern).toBeNull();
        continue;
      }
      expect(kinds.slice(-2)).toEqual(["wear", "pattern"]);
      expect(landed!.startsWith(wheel.tiers[wheel.tierOf(roll.seed!)]!.label)).toBe(true);
      expect(run.caption).toBe(wheel.describe(roll.seed!));
      expect(pattern).toBe(run.caption);
    }
  });

  it("reaches the pattern wheel for a Case Hardened AK-47", () => {
    // Spin the AK-47 skin wheel until it lands on Case Hardened.
    for (let i = 0; ; i++) {
      const run = new SlotRun("weapon_ak47", skins, createRng(`ch${i}`), data);
      run.spin();
      if (run.stage?.title !== "AK-47 | Case Hardened: зношення") continue;
      run.spin();
      expect(run.stage?.kind).toBe("pattern");
      expect(run.stage?.options[0]!.label).toMatch(/^Blue Gem 90%\+ · \d\.\d%$/);
      break;
    }
  });
});

import { describe, expect, it } from "vitest";
import { normalizeSkin, type ByMykelSkin } from "../src/data/normalize";
import type { Roll, Skin } from "../src/engine/types";
import { isPossible, validateDataset, validateSkin } from "../src/engine/validate";
import { asiimov, gloves, rubyKarambit, skin, vanillaKarambit } from "./fixtures";

describe("validateSkin", () => {
  it("accepts the fixtures", () => {
    for (const s of [asiimov, gloves, rubyKarambit, vanillaKarambit, skin()]) expect(validateSkin(s)).toEqual([]);
  });

  it.each<[string, Partial<Skin>, RegExp]>([
    ["no image", { image: "" }, /image/],
    ["bad category", { category: "grenade" as Skin["category"] }, /category/],
    ["bad side", { side: "spec" as Skin["side"] }, /side/],
    ["bad patternType", { patternType: "slaughter" as Skin["patternType"] }, /patternType/],
    ["AK on CT", { side: "ct" }, /t-only/],
    ["wrong weapon in name", { name: "M4A4 | Redline" }, /name/],
    ["min ≥ max", { minFloat: 0.5, maxFloat: 0.4 }, /float range/],
    ["max > 1", { maxFloat: 1.2 }, /float range/],
    ["missing range", { minFloat: null }, /missing float/],
    ["phase on plain finish", { phase: "Ruby" }, /non-Doppler/],
  ])("rejects %s", (_label, overrides, message) => {
    expect(validateSkin(skin(overrides)).join("; ")).toMatch(message);
  });

  it("rejects StatTrak gloves", () => {
    expect(validateSkin({ ...gloves, stattrak: true })).toContain("gloves cannot be StatTrak");
  });

  it("rejects a vanilla non-knife, and a vanilla knife with float or pattern", () => {
    expect(validateSkin({ ...vanillaKarambit, category: "rifle", name: "Karambit" }).join()).toMatch(/only knives/);
    expect(validateSkin({ ...vanillaKarambit, minFloat: 0, maxFloat: 1 }).join()).toMatch(/no float/);
    expect(validateSkin({ ...vanillaKarambit, patternType: "fade" }).join()).toMatch(/no pattern/);
  });

  it("enforces Doppler phase rules", () => {
    expect(validateSkin({ ...rubyKarambit, phase: null }).join()).toMatch(/without a phase/);
    expect(validateSkin({ ...rubyKarambit, phase: "Emerald" }).join()).toMatch(/Emerald/);
    const gamma = { ...rubyKarambit, name: "★ Karambit | Gamma Doppler", finish: "Gamma Doppler" };
    expect(validateSkin({ ...gamma, patternType: "gamma_doppler", phase: "Emerald" })).toEqual([]);
    expect(validateSkin({ ...gamma, patternType: "gamma_doppler", phase: "Sapphire" }).join()).toMatch(/only on Doppler/);
  });
});

describe("validateDataset", () => {
  it("flags duplicate ids", () => {
    expect(validateDataset([asiimov, asiimov]).join()).toMatch(/duplicate/);
  });
});

describe("isPossible", () => {
  const good: Roll = { skinId: asiimov.id, float: Math.fround(0.3), wear: "Field-Tested", variant: "stattrak", seed: 661 };

  it("accepts a real item", () => {
    expect(isPossible(asiimov, good)).toEqual([]);
  });

  it.each<[string, Partial<Roll>, RegExp]>([
    ["another skin", { skinId: "x" }, /another skin/],
    ["Factory New Asiimov", { float: 0.05, wear: "Factory New" }, /outside/],
    ["wrong wear label", { wear: "Minimal Wear" }, /does not match/],
    ["missing float", { float: null }, /missing float/],
    ["Souvenir with no Souvenir version", { variant: "souvenir" }, /Souvenir/],
    ["seed 1001", { seed: 1001 }, /seed/],
    ["fractional seed", { seed: 1.5 }, /seed/],
  ])("rejects %s", (_label, overrides, message) => {
    expect(isPossible(asiimov, { ...good, ...overrides }).join()).toMatch(message);
  });

  it("rejects StatTrak where none exists", () => {
    expect(isPossible(gloves, { ...good, skinId: gloves.id, float: 0.3 }).join()).toMatch(/StatTrak/);
  });

  it("rejects a float or seed on a vanilla knife", () => {
    const roll: Roll = { skinId: vanillaKarambit.id, float: 0.1, wear: "Minimal Wear", variant: "normal", seed: 3 };
    expect(isPossible(vanillaKarambit, roll)).toHaveLength(2);
  });
});

describe("normalizeSkin", () => {
  const base: ByMykelSkin = {
    id: "skin-1",
    name: "★ Karambit | Doppler",
    weapon: { id: "weapon_knife_karambit", name: "Karambit" },
    category: { id: "sfui_invpanel_filter_melee", name: "Knives" },
    pattern: { id: "am_ruby_marbleized", name: "Doppler" },
    min_float: 0,
    max_float: 0.08,
    rarity: { id: "rarity_ancient_weapon", name: "Covert", color: "#eb4b4b" },
    stattrak: true,
    souvenir: false,
    paint_index: "415",
    phase: "Ruby",
    team: { id: "both" },
    image: "https://example.com/k.png",
  };

  it("maps a Doppler phase record", () => {
    expect(normalizeSkin(base)).toMatchObject({ patternType: "doppler", phase: "Ruby", paintIndex: 415, side: "both" });
  });

  it("maps a vanilla knife's HUD id back to its weapon class", () => {
    const vanilla = normalizeSkin({
      ...base,
      name: "★ Karambit",
      weapon: { id: "sfui_wpnhud_knifekaram", name: "Karambit" },
      pattern: null,
      min_float: null,
      max_float: null,
      paint_index: null,
      phase: undefined,
      souvenir: undefined,
    });
    expect(vanilla).toMatchObject({ weapon: "weapon_knife_karambit", finish: null, minFloat: null, souvenir: false });
    expect(validateSkin(vanilla)).toEqual([]);
  });

  it("fails loudly on shapes it cannot represent", () => {
    expect(() => normalizeSkin({ ...base, category: { id: "x", name: "Agents" } })).toThrow(/category/);
    expect(() => normalizeSkin({ ...base, team: { id: "spectators" } })).toThrow(/team/);
    expect(() => normalizeSkin({ ...base, phase: "Phase 5" })).toThrow(/phase/);
    expect(() => normalizeSkin({ ...base, weapon: { id: "sfui_unknown", name: "?" } })).toThrow(/weapon/);
  });
});

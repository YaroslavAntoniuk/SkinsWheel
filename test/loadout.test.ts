import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GROUPS,
  PRESETS,
  SlotRun,
  finishGroups,
  formatSlots,
  parseSlots,
  slotLabel,
  weaponsFor,
  type StageKind,
} from "../src/engine/loadout";
import { createRng } from "../src/engine/rng";
import type { Skin } from "../src/engine/types";
import { isPossible } from "../src/engine/validate";

const skins: Skin[] = JSON.parse(readFileSync(join(import.meta.dirname, "..", "data", "skins.json"), "utf8"));

/** Spins a slot to the end, returning the stages seen in order. */
function play(run: SlotRun): StageKind[] {
  const seen: StageKind[] = [];
  while (run.stage) {
    const { kind, options } = run.stage;
    seen.push(kind);
    expect(options.length).toBeGreaterThan(0);
    const index = run.spin();
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(options.length);
  }
  return seen;
}

describe("slots", () => {
  it("every group and preset resolves to weapons in the data", () => {
    for (const g of GROUPS) expect(weaponsFor(g.id, skins).length).toBeGreaterThan(1);
    for (const p of PRESETS) expect(parseSlots(formatSlots(p.slots), skins)).toEqual(p.slots);
  });

  it("a weapon slot is exactly that weapon", () => {
    expect(weaponsFor("weapon_m4a1", skins).map((w) => w.weaponName)).toEqual(["M4A4"]);
    expect(slotLabel("weapon_m4a1", skins)).toBe("M4A4");
  });

  it("rifles and snipers do not overlap", () => {
    const rifles = weaponsFor("rifle", skins).map((w) => w.weapon);
    expect(rifles).toContain("weapon_ak47");
    expect(rifles).not.toContain("weapon_awp");
    expect(weaponsFor("sniper", skins).map((w) => w.weapon)).toContain("weapon_awp");
  });

  it("parseSlots drops unknown tokens", () => {
    expect(parseSlots("knife, weapon_nope,,gloves", skins)).toEqual(["knife", "gloves"]);
  });
});

describe("finishGroups", () => {
  it("lists every M4A4 finish once, so the wheel shows all of them", () => {
    const m4 = skins.filter((s) => s.weapon === "weapon_m4a1");
    const groups = finishGroups("weapon_m4a1", skins);
    expect(groups.flat()).toHaveLength(m4.length);
    expect(groups).toHaveLength(new Set(m4.map((s) => s.finish)).size);
  });

  it("puts Doppler phases in one segment and nothing else shares one", () => {
    for (const weapon of new Set(skins.map((s) => s.weapon))) {
      for (const group of finishGroups(weapon, skins)) {
        if (group.length > 1) expect(group.every((s) => s.phase !== null)).toBe(true);
      }
    }
  });
});

describe("SlotRun", () => {
  it("shows the first wheel before any spin", () => {
    const run = new SlotRun("knife", skins, createRng("first"));
    expect(run.stage?.kind).toBe("weapon");
    expect(run.stage?.title).toMatch(/ніж/i);
    expect(run.stage?.options.length).toBe(weaponsFor("knife", skins).length);
  });

  it("a weapon slot skips the weapon wheel and lists all its skins", () => {
    const run = new SlotRun("weapon_ak47", skins, createRng("ak"));
    expect(run.stage?.kind).toBe("skin");
    expect(run.stage?.title).toBe("AK-47: скін");
    expect(run.stage?.options).toHaveLength(finishGroups("weapon_ak47", skins).length);
  });

  it("goes weapon → skin → wear for gloves and ends with a possible item", () => {
    const run = new SlotRun("gloves", skins, createRng("gloves"));
    expect(play(run)).toEqual(["weapon", "skin", "wear"]);
    expect(isPossible(run.result!.skin, run.result!.roll)).toEqual([]);
  });

  it("adds a phase wheel for Doppler and skips wear for vanilla", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) seen.add(play(new SlotRun("weapon_knife_karambit", skins, createRng(`k${i}`))).join(">"));
    expect(seen).toContain("skin>wear");
    expect(seen).toContain("skin>phase>wear");
    expect(seen).toContain("skin");
  });

  it("lands the wear wheel on the rolled wear, and every result is possible", () => {
    for (let i = 0; i < 2000; i++) {
      const run = new SlotRun(GROUPS[i % GROUPS.length]!.id, skins, createRng(`r${i}`));
      let wearLabel: string | null = null;
      while (run.stage) {
        const stage = run.stage;
        const index = run.spin();
        if (stage.kind === "wear") wearLabel = stage.options[index]!.label;
      }
      const { skin, roll } = run.result!;
      expect(isPossible(skin, roll)).toEqual([]);
      if (roll.wear) expect(wearLabel?.startsWith(roll.wear)).toBe(true);
    }
  });

  it("replays identically from the same code", () => {
    const a = new SlotRun("knife", skins, createRng("same"));
    const b = new SlotRun("knife", skins, createRng("same"));
    play(a);
    play(b);
    expect(a.result).toEqual(b.result);
  });

  it("refuses an empty slot and spinning past the end", () => {
    expect(() => new SlotRun("weapon_nope", skins, createRng("x"))).toThrow();
    const run = new SlotRun("weapon_knife_karambit", skins, createRng("end"));
    play(run);
    expect(() => run.spin()).toThrow();
  });
});

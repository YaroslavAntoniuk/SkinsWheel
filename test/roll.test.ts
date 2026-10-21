import { describe, expect, it } from "vitest";
import { createRng, newLoadoutCode, randomInt } from "../src/engine/rng";
import { SOUVENIR_CHANCE, STATTRAK_CHANCE, rollItem, rollSeed, rollSkin, rollVariant } from "../src/engine/roll";
import { isPossible } from "../src/engine/validate";
import { asiimov, gloves, rubyKarambit, skin, vanillaKarambit } from "./fixtures";

const N = 100_000;
const pool = [asiimov, gloves, rubyKarambit, skin(), vanillaKarambit, skin({ id: "skin-both", souvenir: true })];

describe("rng", () => {
  it("replays the same sequence for the same code", () => {
    const a = createRng("k7f2q9xa");
    const b = createRng("k7f2q9xa");
    const c = createRng("k7f2q9xb");
    const seqA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(seqA);
    expect(Array.from({ length: 5 }, c)).not.toEqual(seqA);
  });

  it("randomInt covers both ends of an inclusive range", () => {
    const rng = createRng("int");
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(randomInt(rng, 0, 3));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it("newLoadoutCode makes 8 unambiguous characters", () => {
    expect(newLoadoutCode(createRng("code"))).toMatch(/^[a-km-np-z2-9]{8}$/);
  });
});

describe("rolls", () => {
  it("rollSkin refuses an empty pool", () => {
    expect(() => rollSkin([], createRng("x"))).toThrow();
  });

  it("rollItem replays identically from a loadout code", () => {
    const a = createRng("replay");
    const b = createRng("replay");
    expect(rollItem(asiimov, a)).toEqual(rollItem(asiimov, b));
  });

  it("100 000 auto-spins produce no impossible item", () => {
    const rng = createRng("autospin");
    for (let i = 0; i < N; i++) {
      const s = rollSkin(pool, rng);
      expect(isPossible(s, rollItem(s, rng))).toEqual([]);
    }
  });

  it("StatTrak and Souvenir hit their rates and never overlap", () => {
    const both = skin({ souvenir: true });
    const rng = createRng("variant");
    let st = 0;
    let sv = 0;
    for (let i = 0; i < N; i++) {
      const v = rollVariant(both, rng);
      if (v === "stattrak") st++;
      if (v === "souvenir") sv++;
    }
    expect(Math.abs(st / N - STATTRAK_CHANCE)).toBeLessThan(0.01);
    expect(Math.abs(sv / N - SOUVENIR_CHANCE)).toBeLessThan(0.01);
  });

  it("gloves never roll StatTrak", () => {
    const rng = createRng("gloves");
    for (let i = 0; i < 10_000; i++) expect(rollVariant(gloves, rng)).toBe("normal");
  });

  it("seeds cover 0–1000 and vanilla knives get none", () => {
    const rng = createRng("seed");
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < N; i++) {
      const seed = rollSeed(asiimov, rng)!;
      min = Math.min(min, seed);
      max = Math.max(max, seed);
    }
    expect([min, max]).toEqual([0, 1000]);
    let knifeMax = -Infinity;
    for (let i = 0; i < N; i++) knifeMax = Math.max(knifeMax, rollSeed(rubyKarambit, rng)!);
    expect(knifeMax).toBe(999);
    expect(rollSeed(vanillaKarambit, rng)).toBeNull();
    expect(rollItem(vanillaKarambit, rng)).toMatchObject({ float: null, wear: null, seed: null });
  });
});

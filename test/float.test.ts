import { describe, expect, it } from "vitest";
import { DROP_BANDS, formatFloat, remapFloat, rollRawFloat, wearOdds, wearOf } from "../src/engine/float";
import { createRng } from "../src/engine/rng";
import { rollFloat } from "../src/engine/roll";
import type { Wear } from "../src/engine/types";
import { asiimov, gloves, rubyKarambit, skin, vanillaKarambit } from "./fixtures";

const N = 100_000;

function sum(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

describe("drop distribution", () => {
  it("band weights add up to 1", () => {
    expect(sum(DROP_BANDS.map((b) => b.weight))).toBeCloseTo(1, 12);
  });

  it("raw floats land in each band at the stated rate", () => {
    const rng = createRng("raw");
    const counts = DROP_BANDS.map(() => 0);
    for (let i = 0; i < N; i++) {
      const raw = rollRawFloat(rng);
      expect(raw).toBeGreaterThanOrEqual(0);
      expect(raw).toBeLessThan(1);
      counts[DROP_BANDS.findIndex((b) => raw < b.to)]! += 1;
    }
    DROP_BANDS.forEach((b, i) => expect(Math.abs(counts[i]! / N - b.weight)).toBeLessThan(0.01));
  });
});

describe("wearOf", () => {
  it.each<[number, Wear]>([
    [0, "Factory New"],
    [0.0699, "Factory New"],
    [0.07, "Minimal Wear"],
    [0.15, "Field-Tested"],
    [0.38, "Well-Worn"],
    [0.45, "Battle-Scarred"],
    [1, "Battle-Scarred"],
  ])("%f → %s", (float, wear) => {
    expect(wearOf(float)).toBe(wear);
  });
});

describe("remapFloat", () => {
  it("maps raw 0 and 1 to the range ends, in float32", () => {
    expect(remapFloat(0, 0.18, 1)).toBe(Math.fround(0.18));
    expect(remapFloat(1, 0.18, 1)).toBe(1);
  });
});

describe("wearOdds", () => {
  it("Asiimov 0.18–1.00 has no Factory New or Minimal Wear", () => {
    const odds = wearOdds(asiimov);
    expect(odds.has("Factory New")).toBe(false);
    expect(odds.has("Minimal Wear")).toBe(false);
    // The remap squeezes FT into raw [0, 0.244) and stretches BS over raw
    // [0.329, 1), so BS comes out ahead: 47.3% vs 40.5%.
    expect(odds.get("Field-Tested")).toBeCloseTo(0.4047, 4);
    expect(odds.get("Well-Worn")).toBeCloseTo(0.1225, 4);
    expect(odds.get("Battle-Scarred")).toBeCloseTo(0.4728, 4);
  });

  it("a full 0–1 range reproduces the drop distribution", () => {
    const odds = wearOdds(skin({ minFloat: 0, maxFloat: 1 }));
    expect([...odds.values()].map((p) => Number(p.toFixed(6)))).toEqual(DROP_BANDS.map((b) => b.weight));
  });

  it("a Doppler 0–0.08 is only FN or MW", () => {
    expect([...wearOdds(rubyKarambit).keys()]).toEqual(["Factory New", "Minimal Wear"]);
  });

  it("is empty for vanilla knives and broken ranges", () => {
    expect(wearOdds(vanillaKarambit).size).toBe(0);
    expect(wearOdds(skin({ minFloat: 0.5, maxFloat: 0.5 })).size).toBe(0);
  });

  it.each([asiimov, rubyKarambit, gloves, skin()])("sums to 1 and matches 100 000 rolls of $name within 1%", (s) => {
    const odds = wearOdds(s);
    expect(sum(odds.values())).toBeCloseTo(1, 9);

    const rng = createRng(s.id);
    const counts = new Map<Wear, number>();
    for (let i = 0; i < N; i++) {
      const wear = wearOf(rollFloat(s, rng)!);
      counts.set(wear, (counts.get(wear) ?? 0) + 1);
    }
    for (const wear of counts.keys()) expect(odds.has(wear)).toBe(true);
    for (const [wear, p] of odds) expect(Math.abs((counts.get(wear) ?? 0) / N - p)).toBeLessThan(0.01);
  });
});

describe("formatFloat", () => {
  it("shows 4 places on the wheel and 9 on the card", () => {
    expect(formatFloat(Math.fround(0.0712345678), 4)).toBe("0.0712");
    expect(formatFloat(Math.fround(0.0712345678), 9)).toBe("0.071234569");
  });
});

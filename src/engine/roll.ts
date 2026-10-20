import { remapFloat, rollRawFloat, wearOf } from "./float";
import { randomInt, type Rng } from "./rng";
import type { Roll, Skin, Variant } from "./types";

/** StatTrak share of drops for skins that have a StatTrak version. */
export const STATTRAK_CHANCE = 0.1;

/**
 * Souvenir share for skins that also exist as Souvenirs. Valve publishes no
 * figure; this is an estimate and is labelled as such in the UI.
 */
export const SOUVENIR_CHANCE = 0.1;

export const SEED_MIN = 0;
export const SEED_MAX = 1000;

/** Equal-share pick from the pool (the "skin" wheel's default mode). */
export function rollSkin(pool: readonly Skin[], rng: Rng): Skin {
  if (pool.length === 0) throw new Error("rollSkin: empty pool");
  return pool[Math.floor(rng() * pool.length)]!;
}

export function rollFloat(skin: Skin, rng: Rng): number | null {
  if (skin.minFloat === null || skin.maxFloat === null) return null;
  return remapFloat(rollRawFloat(rng), skin.minFloat, skin.maxFloat);
}

/** StatTrak and Souvenir are mutually exclusive on a single item. */
export function rollVariant(skin: Skin, rng: Rng): Variant {
  const r = rng();
  if (skin.stattrak && r < STATTRAK_CHANCE) return "stattrak";
  if (skin.souvenir && r >= 1 - SOUVENIR_CHANCE) return "souvenir";
  return "normal";
}

/** Paint seed, uniform over 0–1000 (1001 values). Vanilla knives have none. */
export function rollSeed(skin: Skin, rng: Rng): number | null {
  if (skin.finish === null) return null;
  return randomInt(rng, SEED_MIN, SEED_MAX);
}

/**
 * Rolls one item in wheel order: float, then variant, then seed. The order is
 * part of the replay contract — changing it changes every saved loadout code.
 */
export function rollItem(skin: Skin, rng: Rng): Roll {
  const float = rollFloat(skin, rng);
  return {
    skinId: skin.id,
    float,
    wear: float === null ? null : wearOf(float),
    variant: rollVariant(skin, rng),
    seed: rollSeed(skin, rng),
  };
}

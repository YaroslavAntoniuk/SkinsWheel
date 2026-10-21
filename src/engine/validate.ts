import { wearOdds, wearOf } from "./float";
import { SEED_MIN, seedMax } from "./roll";
import type { Category, PatternType, Roll, Side, Skin } from "./types";

const CATEGORIES: readonly Category[] = ["rifle", "pistol", "smg", "heavy", "knife", "gloves", "equipment"];
const SIDES: readonly Side[] = ["t", "ct", "both"];
const PATTERN_TYPES: readonly PatternType[] = [
  "none",
  "case_hardened",
  "fade",
  "doppler",
  "gamma_doppler",
  "marble_fade",
  "crimson_web",
  "tiger_tooth",
];

/** Weapons that only one side can buy. Anything else must not claim a side it lacks. */
export const SIDE_LOCKED: Readonly<Record<string, Side>> = {
  weapon_ak47: "t",
  weapon_galilar: "t",
  weapon_sg556: "t",
  weapon_g3sg1: "t",
  weapon_glock: "t",
  weapon_tec9: "t",
  weapon_mac10: "t",
  weapon_sawedoff: "t",
  weapon_m4a1: "ct",
  weapon_m4a1_silencer: "ct",
  weapon_famas: "ct",
  weapon_aug: "ct",
  weapon_scar20: "ct",
  weapon_hkp2000: "ct",
  weapon_usp_silencer: "ct",
  weapon_fiveseven: "ct",
  weapon_mp9: "ct",
  weapon_mag7: "ct",
};

/** Problems with one skin record; an empty list means the record is valid. */
export function validateSkin(skin: Skin): string[] {
  const errors: string[] = [];
  const vanilla = skin.finish === null;

  if (!skin.id) errors.push("missing id");
  if (!/^https:\/\//.test(skin.image)) errors.push("missing or non-https image");
  if (!CATEGORIES.includes(skin.category)) errors.push(`unknown category ${skin.category}`);
  if (!SIDES.includes(skin.side)) errors.push(`unknown side ${skin.side}`);
  if (!PATTERN_TYPES.includes(skin.patternType)) errors.push(`unknown patternType ${skin.patternType}`);

  const locked = SIDE_LOCKED[skin.weapon];
  if (locked && skin.side !== locked) errors.push(`${skin.weapon} is ${locked}-only, record says ${skin.side}`);

  const starred = skin.category === "knife" || skin.category === "gloves";
  const expectedName = `${starred ? "★ " : ""}${skin.weaponName}${vanilla ? "" : ` | ${skin.finish}`}`;
  if (skin.name !== expectedName) errors.push(`name "${skin.name}" ≠ "${expectedName}"`);

  if (vanilla) {
    if (skin.category !== "knife") errors.push("only knives come without a finish");
    if (skin.minFloat !== null || skin.maxFloat !== null) errors.push("vanilla knife must have no float range");
    if (skin.patternType !== "none") errors.push("vanilla knife must have no pattern");
  } else {
    const { minFloat: min, maxFloat: max } = skin;
    if (min === null || max === null) errors.push("missing float range");
    else if (!(min >= 0 && min < max && max <= 1)) errors.push(`bad float range ${min}–${max}`);
    else if (wearOdds(skin).size === 0) errors.push("float range covers no wear");
  }

  if (skin.category === "gloves" && skin.stattrak) errors.push("gloves cannot be StatTrak");

  const dopplerFamily = skin.patternType === "doppler" || skin.patternType === "gamma_doppler";
  if (dopplerFamily && skin.phase === null) errors.push("Doppler record without a phase");
  if (!dopplerFamily && skin.phase !== null) errors.push(`phase ${skin.phase} on a non-Doppler finish`);
  if (skin.phase === "Emerald" && skin.patternType !== "gamma_doppler") errors.push("Emerald exists only on Gamma Doppler");
  if (
    (skin.phase === "Ruby" || skin.phase === "Sapphire" || skin.phase === "Black Pearl") &&
    skin.patternType !== "doppler"
  ) {
    errors.push(`${skin.phase} exists only on Doppler`);
  }

  return errors;
}

/** Problems with a whole dataset: every record plus cross-record rules. */
export function validateDataset(skins: readonly Skin[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const skin of skins) {
    if (seen.has(skin.id)) errors.push(`${skin.id}: duplicate id`);
    seen.add(skin.id);
    for (const e of validateSkin(skin)) errors.push(`${skin.id} (${skin.name}): ${e}`);
  }
  return errors;
}

/**
 * Problems with a roll result; an empty list means the item can exist in the
 * game. Every roll the wheel shows must pass this.
 */
export function isPossible(skin: Skin, roll: Roll): string[] {
  const errors: string[] = [];
  if (roll.skinId !== skin.id) errors.push("roll belongs to another skin");

  if (skin.minFloat === null || skin.maxFloat === null) {
    if (roll.float !== null || roll.wear !== null) errors.push("vanilla knife cannot have a float");
  } else if (roll.float === null) {
    errors.push("missing float");
  } else {
    // Compare in float32, which is how both the game and rollFloat store it.
    if (roll.float < Math.fround(skin.minFloat) || roll.float > Math.fround(skin.maxFloat)) {
      errors.push(`float ${roll.float} outside ${skin.minFloat}–${skin.maxFloat}`);
    }
    if (roll.wear !== wearOf(roll.float)) errors.push(`wear ${roll.wear} does not match float ${roll.float}`);
  }

  if (roll.variant === "stattrak" && !skin.stattrak) errors.push("no StatTrak version exists");
  if (roll.variant === "souvenir" && !skin.souvenir) errors.push("no Souvenir version exists");

  if (skin.finish === null) {
    if (roll.seed !== null) errors.push("vanilla knife cannot have a seed");
  } else if (roll.seed === null || !Number.isInteger(roll.seed) || roll.seed < SEED_MIN || roll.seed > seedMax(skin)) {
    errors.push(`seed ${roll.seed} outside ${SEED_MIN}–${seedMax(skin)}`);
  }

  return errors;
}

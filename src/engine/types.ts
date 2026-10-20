// One record = one weapon + finish (paint kit). Wear, float, StatTrak and
// pattern seed are roll results, never properties of the record.

export type Category = "rifle" | "pistol" | "smg" | "heavy" | "knife" | "gloves" | "equipment";

export type Side = "t" | "ct" | "both";

export type PatternType =
  | "none"
  | "case_hardened"
  | "fade"
  | "doppler"
  | "gamma_doppler"
  | "marble_fade"
  | "crimson_web"
  | "tiger_tooth";

export type DopplerPhase =
  | "Phase 1"
  | "Phase 2"
  | "Phase 3"
  | "Phase 4"
  | "Ruby"
  | "Sapphire"
  | "Black Pearl"
  | "Emerald";

export interface Skin {
  /** Stable source id (ByMykel `skin-…`); unique across Doppler phases. */
  id: string;
  /** Display name exactly as the game prints it, e.g. "★ Karambit | Doppler". */
  name: string;
  /** Internal weapon class name (`weapon_ak47`) — never the localized name. */
  weapon: string;
  weaponName: string;
  /** Finish name, null for vanilla knives. */
  finish: string | null;
  category: Category;
  side: Side;
  rarity: string;
  rarityColor: string;
  paintIndex: number | null;
  /** Null for vanilla knives, which have no float at all. */
  minFloat: number | null;
  maxFloat: number | null;
  /** A StatTrak version of this skin exists. */
  stattrak: boolean;
  /** A Souvenir version of this skin exists. A single item is never both. */
  souvenir: boolean;
  patternType: PatternType;
  /** Doppler / Gamma Doppler phase; set by paint kit, not by seed. */
  phase: DopplerPhase | null;
  image: string;
}

export type Wear =
  | "Factory New"
  | "Minimal Wear"
  | "Field-Tested"
  | "Well-Worn"
  | "Battle-Scarred";

export type Variant = "normal" | "stattrak" | "souvenir";

export interface Roll {
  skinId: string;
  /** float32 value, or null for vanilla knives. */
  float: number | null;
  wear: Wear | null;
  variant: Variant;
  /** Paint seed 0–1000 inclusive; null for vanilla knives. */
  seed: number | null;
}

import type { Category, DopplerPhase, PatternType, Side, Skin } from "../engine/types";

/** The subset of a ByMykel CSGO-API `skins.json` entry that we read. */
export interface ByMykelSkin {
  id: string;
  name: string;
  weapon: { id: string; name: string };
  category: { id: string; name: string } | null;
  pattern: { id: string; name: string } | null;
  min_float: number | null;
  max_float: number | null;
  rarity: { id: string; name: string; color: string };
  stattrak: boolean;
  souvenir?: boolean;
  paint_index: string | null;
  phase?: string;
  team: { id: string } | null;
  image: string;
}

const CATEGORY_BY_NAME: Readonly<Record<string, Category>> = {
  Rifles: "rifle",
  Pistols: "pistol",
  SMGs: "smg",
  Heavy: "heavy",
  Knives: "knife",
  Gloves: "gloves",
  Equipment: "equipment",
};

const SIDE_BY_TEAM: Readonly<Record<string, Side>> = {
  terrorists: "t",
  "counter-terrorists": "ct",
  both: "both",
};

const PATTERN_BY_FINISH: Readonly<Record<string, PatternType>> = {
  "Case Hardened": "case_hardened",
  Fade: "fade",
  Doppler: "doppler",
  "Gamma Doppler": "gamma_doppler",
  "Marble Fade": "marble_fade",
  "Crimson Web": "crimson_web",
  "Tiger Tooth": "tiger_tooth",
};

const PHASES: readonly DopplerPhase[] = [
  "Phase 1",
  "Phase 2",
  "Phase 3",
  "Phase 4",
  "Ruby",
  "Sapphire",
  "Black Pearl",
  "Emerald",
];

/**
 * ByMykel files vanilla knives under a HUD string (`sfui_wpnhud_knifekaram`)
 * instead of the weapon class. Map them back so `weapon` stays the internal name.
 */
const VANILLA_KNIFE_WEAPON: Readonly<Record<string, string>> = {
  sfui_wpnhud_knife_butterfly: "weapon_knife_butterfly",
  sfui_wpnhud_knife_canis: "weapon_knife_canis",
  sfui_wpnhud_knife_cord: "weapon_knife_cord",
  sfui_wpnhud_knife_falchion_advanced: "weapon_knife_falchion",
  sfui_wpnhud_knife_gypsy_jackknife: "weapon_knife_gypsy_jackknife",
  sfui_wpnhud_knife_kukri: "weapon_knife_kukri",
  sfui_wpnhud_knife_outdoor: "weapon_knife_outdoor",
  sfui_wpnhud_knife_push: "weapon_knife_push",
  sfui_wpnhud_knife_skeleton: "weapon_knife_skeleton",
  sfui_wpnhud_knife_stiletto: "weapon_knife_stiletto",
  sfui_wpnhud_knife_survival_bowie: "weapon_knife_survival_bowie",
  sfui_wpnhud_knife_ursus: "weapon_knife_ursus",
  sfui_wpnhud_knife_widowmaker: "weapon_knife_widowmaker",
  sfui_wpnhud_knifebayonet: "weapon_bayonet",
  sfui_wpnhud_knifecss: "weapon_knife_css",
  sfui_wpnhud_knifeflip: "weapon_knife_flip",
  sfui_wpnhud_knifegut: "weapon_knife_gut",
  sfui_wpnhud_knifekaram: "weapon_knife_karambit",
  sfui_wpnhud_knifem9: "weapon_knife_m9_bayonet",
  sfui_wpnhud_knifetactical: "weapon_knife_tactical",
};

/**
 * Converts one source entry. Throws on anything the model cannot represent, so
 * a source format change fails the sync loudly instead of shipping bad data.
 */
export function normalizeSkin(src: ByMykelSkin): Skin {
  const category = src.category ? CATEGORY_BY_NAME[src.category.name] : undefined;
  if (!category) throw new Error(`${src.id}: unknown category ${src.category?.name}`);

  const side = src.team ? SIDE_BY_TEAM[src.team.id] : undefined;
  if (!side) throw new Error(`${src.id}: unknown team ${src.team?.id}`);

  const finish = src.pattern?.name ?? null;
  const weapon = VANILLA_KNIFE_WEAPON[src.weapon.id] ?? src.weapon.id;
  if (!weapon.startsWith("weapon_") && category !== "gloves") {
    throw new Error(`${src.id}: unmapped weapon id ${src.weapon.id}`);
  }

  let phase: DopplerPhase | null = null;
  if (src.phase !== undefined) {
    if (!PHASES.includes(src.phase as DopplerPhase)) throw new Error(`${src.id}: unknown phase ${src.phase}`);
    phase = src.phase as DopplerPhase;
  }

  const paintIndex = src.paint_index === null ? null : Number(src.paint_index);

  return {
    id: src.id,
    name: src.name,
    weapon,
    weaponName: src.weapon.name,
    finish,
    category,
    side,
    rarity: src.rarity.name,
    rarityColor: src.rarity.color,
    paintIndex: Number.isFinite(paintIndex) ? paintIndex : null,
    minFloat: finish === null ? null : src.min_float,
    maxFloat: finish === null ? null : src.max_float,
    stattrak: src.stattrak,
    souvenir: src.souvenir ?? false,
    patternType: finish === null ? "none" : (PATTERN_BY_FINISH[finish] ?? "none"),
    phase,
    image: src.image,
  };
}

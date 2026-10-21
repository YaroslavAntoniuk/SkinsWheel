import { wearOdds } from "./float";
import type { Rng } from "./rng";
import { rollItem } from "./roll";
import type { Roll, Skin, Wear } from "./types";

// A loadout is a list of slots chosen in settings. Each slot is spun as a
// chain of wheels: weapon (only when the slot allows several) → skin →
// Doppler phase (only for Doppler finishes) → wear (not for vanilla knives).

export type Group = "knife" | "gloves" | "rifle" | "sniper" | "pistol" | "smg" | "heavy";

/** A group token ("knife") or one weapon's internal name ("weapon_m4a1"). */
export type Slot = Group | (string & {});

export const GROUPS: readonly { id: Group; label: string }[] = [
  { id: "knife", label: "Будь-який ніж" },
  { id: "gloves", label: "Будь-які рукавички" },
  { id: "rifle", label: "Будь-яка гвинтівка" },
  { id: "sniper", label: "Будь-яка снайперка" },
  { id: "pistol", label: "Будь-який пістолет" },
  { id: "smg", label: "Будь-який SMG" },
  { id: "heavy", label: "Будь-яка важка" },
];

export const SNIPERS: ReadonlySet<string> = new Set(["weapon_awp", "weapon_ssg08", "weapon_scar20", "weapon_g3sg1"]);

export const PRESETS: readonly { label: string; slots: Slot[] }[] = [
  { label: "Ніж", slots: ["knife"] },
  { label: "Рукавички", slots: ["gloves"] },
  { label: "Ніж + рукавички", slots: ["knife", "gloves"] },
  { label: "Ніж + рукавички + M4A4", slots: ["knife", "gloves", "weapon_m4a1"] },
  { label: "Ніж + рукавички + AK-47", slots: ["knife", "gloves", "weapon_ak47"] },
  { label: "Пістолети", slots: ["pistol"] },
  { label: "Повний лоадаут", slots: ["knife", "gloves", "rifle", "sniper", "pistol"] },
];

export function isGroup(slot: Slot): slot is Group {
  return GROUPS.some((g) => g.id === slot);
}

function inGroup(skin: Skin, group: Group): boolean {
  switch (group) {
    case "sniper":
      return SNIPERS.has(skin.weapon);
    case "rifle":
      return skin.category === "rifle" && !SNIPERS.has(skin.weapon);
    default:
      return skin.category === group;
  }
}

export interface WeaponInfo {
  weapon: string;
  weaponName: string;
  category: Skin["category"];
}

/** Every weapon in the data, in a stable order for menus. */
export function allWeapons(skins: readonly Skin[]): WeaponInfo[] {
  const byWeapon = new Map<string, WeaponInfo>();
  for (const s of skins) {
    if (!byWeapon.has(s.weapon)) byWeapon.set(s.weapon, { weapon: s.weapon, weaponName: s.weaponName, category: s.category });
  }
  return [...byWeapon.values()].sort((a, b) => a.weaponName.localeCompare(b.weaponName));
}

/** Weapons a slot can land on; one entry for a weapon slot. */
export function weaponsFor(slot: Slot, skins: readonly Skin[]): WeaponInfo[] {
  const matches = isGroup(slot) ? (s: Skin) => inGroup(s, slot) : (s: Skin) => s.weapon === slot;
  return allWeapons(skins.filter(matches));
}

export function slotLabel(slot: Slot, skins: readonly Skin[]): string {
  const group = GROUPS.find((g) => g.id === slot);
  if (group) return group.label;
  return skins.find((s) => s.weapon === slot)?.weaponName ?? slot;
}

/** Parses "knife,gloves,weapon_m4a1", dropping tokens the data does not know. */
export function parseSlots(text: string, skins: readonly Skin[]): Slot[] {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t !== "" && weaponsFor(t, skins).length > 0);
}

export function formatSlots(slots: readonly Slot[]): string {
  return slots.join(",");
}

export interface Option {
  label: string;
  color: string;
  /** Relative segment width = the real chance of this option. */
  weight: number;
  image?: string;
}

export type StageKind = "weapon" | "skin" | "phase" | "wear";

export interface Stage {
  kind: StageKind;
  title: string;
  options: Option[];
}

export const WEAR_COLORS: Readonly<Record<Wear, string>> = {
  "Factory New": "#2e7d32",
  "Minimal Wear": "#558b2f",
  "Field-Tested": "#f9a825",
  "Well-Worn": "#ef6c00",
  "Battle-Scarred": "#c62828",
};

const WEAPON_COLOR = "#3b4252";

/** One segment per finish; Doppler phases share one segment and get their own wheel. */
export function finishGroups(weapon: string, skins: readonly Skin[]): Skin[][] {
  const groups = new Map<string, Skin[]>();
  for (const s of skins) {
    if (s.weapon !== weapon) continue;
    const key = s.finish ?? "";
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups.values()].sort((a, b) => (a[0]!.finish ?? "").localeCompare(b[0]!.finish ?? ""));
}

/**
 * Spins one slot stage by stage. `stage` is what the wheel shows right now —
 * it is set from the moment the slot starts, so the wheel never shows the
 * previous slot's options. `spin()` picks the landing index and advances.
 */
export class SlotRun {
  stage: Stage | null = null;
  result: { skin: Skin; roll: Roll } | null = null;

  private weapon: WeaponInfo | null = null;
  private weaponChoices: WeaponInfo[] = [];
  private finishes: Skin[][] = [];
  private phases: Skin[] = [];
  private skin: Skin | null = null;
  private roll: Roll | null = null;
  private wearOrder: Wear[] = [];

  constructor(
    readonly slot: Slot,
    private readonly skins: readonly Skin[],
    private readonly rng: Rng,
  ) {
    const weapons = weaponsFor(slot, skins);
    if (weapons.length === 0) throw new Error(`no skins for slot ${slot}`);
    if (weapons.length === 1) this.enterSkin(weapons[0]!);
    else {
      this.stage = {
        kind: "weapon",
        title: `${slotLabel(slot, skins)}: яка зброя?`,
        options: weapons.map((w) => ({ label: w.weaponName, color: WEAPON_COLOR, weight: 1 })),
      };
      this.weaponChoices = weapons;
    }
  }


  /** Picks where the current wheel lands, advances, and returns that index. */
  spin(): number {
    const stage = this.stage;
    if (!stage) throw new Error("slot already finished");
    const index = stage.kind === "wear" ? this.wearIndex() : Math.floor(this.rng() * stage.options.length);

    switch (stage.kind) {
      case "weapon":
        this.enterSkin(this.weaponChoices[index]!);
        break;
      case "skin": {
        const group = this.finishes[index]!;
        if (group.length > 1) this.enterPhase(group);
        else this.enterWear(group[0]!);
        break;
      }
      case "phase":
        this.enterWear(this.phases[index]!);
        break;
      case "wear":
        this.finish();
        break;
    }
    return index;
  }

  private enterSkin(weapon: WeaponInfo): void {
    this.weapon = weapon;
    this.finishes = finishGroups(weapon.weapon, this.skins);
    this.stage = {
      kind: "skin",
      title: `${weapon.weaponName}: скін`,
      options: this.finishes.map((g) => {
        const first = g[0]!;
        return { label: first.finish ?? "Vanilla", color: first.rarityColor, weight: 1, image: first.image };
      }),
    };
  }

  private enterPhase(group: Skin[]): void {
    this.phases = group;
    this.stage = {
      kind: "phase",
      title: `${this.weapon!.weaponName} | ${group[0]!.finish}: фаза (шанси приблизні)`,
      options: group.map((s) => ({ label: s.phase ?? "?", color: s.rarityColor, weight: 1, image: s.image })),
    };
  }

  private enterWear(skin: Skin): void {
    this.skin = skin;
    // The whole item is decided here; the wear wheel then lands on its wear.
    this.roll = rollItem(skin, this.rng);
    if (this.roll.wear === null) {
      this.finish();
      return;
    }
    const odds = [...wearOdds(skin)];
    this.stage = {
      kind: "wear",
      title: `${skin.name.replace(/^★ /, "")}${skin.phase ? ` (${skin.phase})` : ""}: зношення`,
      options: odds.map(([wear, p]) => ({ label: `${wear} ${(p * 100).toFixed(1)}%`, color: WEAR_COLORS[wear], weight: p })),
    };
    this.wearOrder = odds.map(([wear]) => wear);
  }


  private wearIndex(): number {
    return this.wearOrder.indexOf(this.roll!.wear!);
  }

  private finish(): void {
    this.result = { skin: this.skin!, roll: this.roll! };
    this.stage = null;
  }
}

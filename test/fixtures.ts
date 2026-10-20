import type { Skin } from "../src/engine/types";

export function skin(overrides: Partial<Skin> = {}): Skin {
  return {
    id: "skin-test",
    name: "AK-47 | Redline",
    weapon: "weapon_ak47",
    weaponName: "AK-47",
    finish: "Redline",
    category: "rifle",
    side: "t",
    rarity: "Classified",
    rarityColor: "#d32ce6",
    paintIndex: 282,
    minFloat: 0.1,
    maxFloat: 0.7,
    stattrak: true,
    souvenir: false,
    patternType: "none",
    phase: null,
    image: "https://example.com/redline.png",
    ...overrides,
  };
}

export const asiimov = skin({
  id: "skin-asiimov",
  name: "AWP | Asiimov",
  weapon: "weapon_awp",
  weaponName: "AWP",
  finish: "Asiimov",
  side: "both",
  minFloat: 0.18,
  maxFloat: 1,
});

export const vanillaKarambit = skin({
  id: "skin-vanilla-karambit",
  name: "★ Karambit",
  weapon: "weapon_knife_karambit",
  weaponName: "Karambit",
  finish: null,
  category: "knife",
  side: "both",
  paintIndex: null,
  minFloat: null,
  maxFloat: null,
});

export const rubyKarambit = skin({
  id: "skin-ruby-karambit",
  name: "★ Karambit | Doppler",
  weapon: "weapon_knife_karambit",
  weaponName: "Karambit",
  finish: "Doppler",
  category: "knife",
  side: "both",
  paintIndex: 415,
  minFloat: 0,
  maxFloat: 0.08,
  patternType: "doppler",
  phase: "Ruby",
});

export const gloves = skin({
  id: "skin-gloves",
  name: "★ Sport Gloves | Vice",
  weapon: "sporty_gloves",
  weaponName: "Sport Gloves",
  finish: "Vice",
  category: "gloves",
  side: "both",
  minFloat: 0.06,
  maxFloat: 0.8,
  stattrak: false,
});

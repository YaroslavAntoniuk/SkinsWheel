import skinsData from "../data/skins.json";
import { formatFloat, wearOdds } from "./engine/float";
import { createRng, newLoadoutCode, type Rng } from "./engine/rng";
import { rollItem, rollSkin } from "./engine/roll";
import type { Roll, Skin, Wear } from "./engine/types";
import { isPossible } from "./engine/validate";
import { Wheel, type Segment } from "./ui/wheel";
import "./style.css";

const skins = skinsData as Skin[];

interface Slot {
  label: string;
  matches: (s: Skin) => boolean;
}

const SNIPERS = new Set(["weapon_awp", "weapon_ssg08", "weapon_scar20", "weapon_g3sg1"]);

// Knife first: the most valuable roll up front keeps viewers to the end.
const SLOTS: readonly Slot[] = [
  { label: "Ніж", matches: (s) => s.category === "knife" },
  { label: "Рукавички", matches: (s) => s.category === "gloves" },
  { label: "Гвинтівка", matches: (s) => s.category === "rifle" && !SNIPERS.has(s.weapon) },
  { label: "Снайперка", matches: (s) => SNIPERS.has(s.weapon) },
  { label: "Пістолет", matches: (s) => s.category === "pistol" },
];

/** Segments on the skin wheel; more than this stops being readable. */
const SKIN_SEGMENTS = 12;

const WEAR_COLORS: Readonly<Record<Wear, string>> = {
  "Factory New": "#2e7d32",
  "Minimal Wear": "#558b2f",
  "Field-Tested": "#f9a825",
  "Well-Worn": "#ef6c00",
  "Battle-Scarred": "#c62828",
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const spinMs = () => (reducedMotion ? 0 : $<HTMLInputElement>("fast").checked ? 1500 : 5000);

const wheel = new Wheel($<HTMLCanvasElement>("wheel"));
let code = location.hash.slice(1) || newLoadoutCode();
let rng: Rng = createRng(code);
let slotIndex = 0;
let busy = false;
const results: { slot: Slot; skin: Skin; roll: Roll }[] = [];

function reset(newCode: string): void {
  code = newCode;
  history.replaceState(null, "", `#${code}`);
  rng = createRng(code);
  slotIndex = 0;
  results.length = 0;
  $("code").textContent = code;
  $("cards").replaceChildren();
  render();
}

function render(): void {
  const slot = SLOTS[slotIndex];
  $("slot").textContent = slot ? slot.label : "Лоадаут готовий";
  $<HTMLButtonElement>("spin").disabled = !slot || busy;
}

/** Equal-share sample of distinct skins for the wheel's segments. */
function sampleSegments(pool: Skin[]): Skin[] {
  const picked = new Set<Skin>();
  const want = Math.min(SKIN_SEGMENTS, pool.length);
  while (picked.size < want) picked.add(rollSkin(pool, rng));
  return [...picked];
}

function skinLabel(skin: Skin): string {
  const short = skin.name.replace(/^★ /, "");
  return skin.phase ? `${short} (${skin.phase})` : short;
}

async function spin(): Promise<void> {
  const slot = SLOTS[slotIndex];
  if (!slot || busy) return;
  busy = true;
  render();

  const choices = sampleSegments(skins.filter(slot.matches));
  const skin = rollSkin(choices, rng);
  const roll = rollItem(skin, rng);
  const problems = isPossible(skin, roll);
  if (problems.length > 0) throw new Error(`impossible roll: ${problems.join("; ")}`);

  const visual = Math.random;
  wheel.setSegments(choices.map((s): Segment => ({ label: skinLabel(s), color: s.rarityColor, weight: 1 })));
  await wheel.spinTo(choices.indexOf(skin), visual, spinMs());

  if (roll.wear) {
    // Segment widths are this skin's real wear odds, impossible wears left off.
    const odds = [...wearOdds(skin)];
    wheel.setSegments(
      odds.map(([wear, p]) => ({ label: `${wear} ${(p * 100).toFixed(1)}%`, color: WEAR_COLORS[wear], weight: p })),
    );
    await wheel.spinTo(
      odds.findIndex(([wear]) => wear === roll.wear),
      visual,
      spinMs(),
    );
  }

  results.push({ slot, skin, roll });
  $("cards").append(card(slot, skin, roll));
  slotIndex++;
  busy = false;
  render();
}

function card(slot: Slot, skin: Skin, roll: Roll): HTMLElement {
  const el = document.createElement("article");
  el.className = "card";
  el.style.setProperty("--rarity", skin.rarityColor);

  const img = document.createElement("img");
  img.src = skin.image;
  img.alt = skin.name;
  img.loading = "lazy";

  const prefix = roll.variant === "stattrak" ? "StatTrak™ " : roll.variant === "souvenir" ? "Souvenir " : "";
  const name = document.createElement("h3");
  name.textContent = `${skin.name.startsWith("★") ? "★ " : ""}${prefix}${skin.name.replace(/^★ /, "")}`;

  const meta = document.createElement("p");
  const parts = [slot.label];
  if (skin.phase) parts.push(skin.phase);
  if (roll.wear && roll.float !== null) parts.push(roll.wear, formatFloat(roll.float, 9));
  if (roll.seed !== null) parts.push(`сід ${roll.seed}`);
  meta.textContent = parts.join(" · ");

  el.append(img, name, meta);
  return el;
}

$("spin").addEventListener("click", () => void spin());
$("new").addEventListener("click", () => reset(newLoadoutCode()));
window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.code === "Space") {
    e.preventDefault();
    void spin();
  } else if (e.code === "KeyN") {
    reset(newLoadoutCode());
  }
});

reset(code);

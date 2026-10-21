import skinsData from "../data/skins.json";
import blueData from "../patterns/blue.json";
import fadeData from "../patterns/fade.json";
import { formatFloat } from "./engine/float";
import {
  GROUPS,
  PRESETS,
  SlotRun,
  allWeapons,
  formatSlots,
  parseSlots,
  type Slot,
} from "./engine/loadout";
import type { BlueFile, FadeFile, PatternData } from "./engine/patterns";
import { createRng, newLoadoutCode, type Rng } from "./engine/rng";
import type { Roll, Skin } from "./engine/types";
import { isPossible } from "./engine/validate";
import { Wheel } from "./ui/wheel";
import "./style.css";

const skins = skinsData as Skin[];
const patterns: PatternData = { fade: fadeData as FadeFile, blue: blueData as BlueFile };
const DEFAULT_SLOTS: Slot[] = ["knife", "gloves"];
/** How long the landed result stays on screen before the next wheel appears. */
const RESULT_PAUSE_MS = 1400;

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  knife: "Ножі",
  gloves: "Рукавички",
  rifle: "Гвинтівки",
  pistol: "Пістолети",
  smg: "SMG",
  heavy: "Важка",
  equipment: "Інше",
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const wheel = new Wheel($<HTMLCanvasElement>("wheel"));
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface State {
  code: string;
  slots: Slot[];
  nick: string;
  fast: boolean;
}

let state: State = readState();
let rng: Rng = createRng(state.code);
let slotIndex = 0;
let run: SlotRun | null = null;
let busy = false;

// ---- state in the URL (shareable, replayable) with a per-browser fallback ----

function readState(): State {
  const params = new URLSearchParams(location.hash.slice(1));
  let saved: Partial<State> = {};
  try {
    saved = JSON.parse(localStorage.getItem("skinswheel") ?? "{}") as Partial<State>;
  } catch {
    // Storage blocked or corrupt: fall back to defaults.
  }
  const slots = parseSlots(params.get("slots") ?? formatSlots(saved.slots ?? []), skins);
  return {
    code: params.get("code") || newLoadoutCode(),
    slots: slots.length > 0 ? slots : DEFAULT_SLOTS,
    nick: params.get("nick") ?? saved.nick ?? "",
    fast: saved.fast ?? false,
  };
}

function writeState(): void {
  const params = new URLSearchParams({ code: state.code, slots: formatSlots(state.slots) });
  if (state.nick) params.set("nick", state.nick);
  history.replaceState(null, "", `#${params}`);
  try {
    localStorage.setItem("skinswheel", JSON.stringify({ slots: state.slots, nick: state.nick, fast: state.fast }));
  } catch {
    // Not persisted; the URL still carries everything.
  }
}

// ---- spinning ----

function start(): void {
  writeState();
  rng = createRng(state.code);
  slotIndex = 0;
  $("cards").replaceChildren();
  $("code").textContent = state.code;
  $("nick").textContent = state.nick;
  enterSlot();
}

function enterSlot(): void {
  const slot = state.slots[slotIndex];
  run = slot === undefined ? null : new SlotRun(slot, skins, rng, patterns);
  showStage();
}

/** Puts the current stage's wheel and title on screen before anyone presses spin. */
function showStage(): void {
  const stage = run?.stage;
  $("progress").textContent = run ? `Слот ${slotIndex + 1} з ${state.slots.length}` : "";
  $("title").textContent = stage ? stage.title : "Лоадаут готовий";
  $("caption").textContent = "";
  $("wheel").hidden = !stage;
  if (stage) wheel.setSegments(stage.options);
  render();
}

function render(): void {
  $<HTMLButtonElement>("spin").disabled = !run?.stage || busy;
}

const spinMs = () => (reducedMotion ? 0 : state.fast ? 1500 : 5000);
const pause = (ms: number) => new Promise((r) => setTimeout(r, reducedMotion ? Math.min(ms, 400) : ms));

async function spin(): Promise<void> {
  const stage = run?.stage;
  if (!run || !stage || busy) return;
  busy = true;
  render();

  const index = run.spin();
  await wheel.spinTo(index, Math.random, spinMs());
  $("caption").textContent = run.caption ?? stage.options[index]!.label;
  await pause(RESULT_PAUSE_MS);

  if (run.result) {
    const { skin, roll, pattern } = run.result;
    const problems = isPossible(skin, roll);
    if (problems.length > 0) throw new Error(`impossible roll: ${problems.join("; ")}`);
    $("cards").append(card(skin, roll, pattern));
    slotIndex++;
    enterSlot();
  } else {
    showStage();
  }
  busy = false;
  render();
}

function card(skin: Skin, roll: Roll, pattern: string | null): HTMLElement {
  const el = document.createElement("article");
  el.className = "card";
  el.style.setProperty("--rarity", skin.rarityColor);

  const img = document.createElement("img");
  img.src = skin.image;
  img.alt = skin.name;

  const prefix = roll.variant === "stattrak" ? "StatTrak™ " : roll.variant === "souvenir" ? "Souvenir " : "";
  const name = document.createElement("h3");
  name.textContent = `${skin.name.startsWith("★") ? "★ " : ""}${prefix}${skin.name.replace(/^★ /, "")}`;

  const meta = document.createElement("p");
  const parts: string[] = [];
  if (skin.phase) parts.push(skin.phase);
  if (roll.wear && roll.float !== null) parts.push(roll.wear, formatFloat(roll.float, 9));
  if (pattern) parts.push(pattern);
  else if (roll.seed !== null) parts.push(`сід ${roll.seed}`);
  meta.textContent = parts.join(" · ");

  el.append(img, name, meta);
  return el;
}

// ---- settings ----

const dialog = $<HTMLDialogElement>("settings");
let draft: Slot[] = [];

function slotSelect(value: Slot): HTMLSelectElement {
  const select = document.createElement("select");
  const groups = document.createElement("optgroup");
  groups.label = "Будь-яка з групи";
  for (const g of GROUPS) groups.append(new Option(g.label, g.id));
  select.append(groups);

  const byCategory = new Map<string, HTMLOptGroupElement>();
  for (const w of allWeapons(skins)) {
    let og = byCategory.get(w.category);
    if (!og) {
      og = document.createElement("optgroup");
      og.label = CATEGORY_LABELS[w.category] ?? w.category;
      byCategory.set(w.category, og);
    }
    og.append(new Option(w.weaponName, w.weapon));
  }
  for (const cat of Object.keys(CATEGORY_LABELS)) {
    const og = byCategory.get(cat);
    if (og) select.append(og);
  }
  select.value = value;
  return select;
}

function renderDraft(): void {
  const list = $("slots");
  list.replaceChildren(
    ...draft.map((slot, i) => {
      const li = document.createElement("li");
      const select = slotSelect(slot);
      select.setAttribute("aria-label", `Слот ${i + 1}`);
      select.addEventListener("change", () => (draft[i] = select.value));

      const button = (label: string, title: string, onClick: () => void, disabled = false) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "icon";
        b.textContent = label;
        b.title = title;
        b.disabled = disabled;
        b.addEventListener("click", () => {
          onClick();
          renderDraft();
        });
        return b;
      };
      const swap = (a: number, b: number) => ([draft[a], draft[b]] = [draft[b]!, draft[a]!]);

      li.append(
        select,
        button("↑", "Вище", () => swap(i, i - 1), i === 0),
        button("↓", "Нижче", () => swap(i, i + 1), i === draft.length - 1),
        button("✕", "Прибрати", () => draft.splice(i, 1), draft.length === 1),
      );
      return li;
    }),
  );
}

function openSettings(): void {
  if (busy) return;
  draft = [...state.slots];
  renderDraft();
  $<HTMLInputElement>("nick-input").value = state.nick;
  $<HTMLInputElement>("fast").checked = state.fast;
  dialog.showModal();
}

$("presets").append(
  ...PRESETS.map((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = p.label;
    b.addEventListener("click", () => {
      draft = [...p.slots];
      renderDraft();
    });
    return b;
  }),
);

$("add-slot").addEventListener("click", () => {
  draft.push("pistol");
  renderDraft();
});

dialog.addEventListener("close", () => {
  if (dialog.returnValue !== "apply") return;
  state = {
    code: newLoadoutCode(),
    slots: draft,
    nick: $<HTMLInputElement>("nick-input").value.trim(),
    fast: $<HTMLInputElement>("fast").checked,
  };
  start();
});

// ---- controls ----

$("spin").addEventListener("click", () => void spin());
$("again").addEventListener("click", () => {
  if (busy) return;
  state = { ...state, code: newLoadoutCode() };
  start();
});
$("open-settings").addEventListener("click", openSettings);

window.addEventListener("keydown", (e) => {
  if (dialog.open || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.code === "Space") {
    e.preventDefault();
    void spin();
  } else if (e.code === "KeyN" && !busy) {
    state = { ...state, code: newLoadoutCode() };
    start();
  } else if (e.code === "KeyS") {
    openSettings();
  }
});

start();

// CI gate: checks every record in data/skins.json, then auto-spins the engine
// and checks every result with isPossible.
//
//   pnpm validate [spins=10000]

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRng } from "../src/engine/rng";
import { rollItem, rollSkin } from "../src/engine/roll";
import type { Skin } from "../src/engine/types";
import { isPossible, validateDataset } from "../src/engine/validate";

const spins = Number(process.argv[2] ?? 10_000);
const skins: Skin[] = JSON.parse(readFileSync(join(import.meta.dirname, "..", "data", "skins.json"), "utf8"));

const errors = validateDataset(skins);

const rng = createRng("validate");
for (let i = 0; i < spins && errors.length < 50; i++) {
  const skin = rollSkin(skins, rng);
  const roll = rollItem(skin, rng);
  for (const e of isPossible(skin, roll)) errors.push(`spin ${i} ${skin.name}: ${e}`);
}

if (errors.length > 0) {
  console.error(`validator: ${errors.length} problem(s)`);
  for (const e of errors.slice(0, 50)) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`validator: ${skins.length} skins OK, ${spins} spins OK`);

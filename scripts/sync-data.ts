// Pulls ByMykel CSGO-API at a pinned commit, normalizes it to our model,
// validates it, and only then writes data/. A red validator leaves the
// previous data in place, so the wheel keeps running on the last good set.
//
//   pnpm sync-data

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeSkin, type ByMykelSkin } from "../src/data/normalize";
import { validateDataset } from "../src/engine/validate";
import type { Skin } from "../src/engine/types";

const SOURCE_REPO = "https://github.com/ByMykel/CSGO-API";
const DATA_DIR = join(import.meta.dirname, "..", "data");

function headSha(): string {
  const out = execFileSync("git", ["ls-remote", SOURCE_REPO, "refs/heads/main"], { encoding: "utf8" });
  const sha = out.split(/\s/)[0];
  if (!sha || !/^[0-9a-f]{40}$/.test(sha)) throw new Error(`could not resolve ${SOURCE_REPO} main: ${out}`);
  return sha;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function main(): Promise<void> {
  const sha = headSha();
  const url = `https://raw.githubusercontent.com/ByMykel/CSGO-API/${sha}/public/api/en/skins.json`;
  console.log(`source ${SOURCE_REPO} @ ${sha}`);

  const raw = await fetchJson<ByMykelSkin[]>(url);
  const skins = raw.map(normalizeSkin).sort((a, b) => a.id.localeCompare(b.id));

  const errors = validateDataset(skins);
  if (errors.length > 0) {
    console.error(`validator: ${errors.length} problem(s); data/ left unchanged`);
    for (const e of errors.slice(0, 50)) console.error(`  ${e}`);
    process.exit(1);
  }

  const skinsPath = join(DATA_DIR, "skins.json");
  const previous: Skin[] = existsSync(skinsPath) ? JSON.parse(readFileSync(skinsPath, "utf8")) : [];
  const before = new Set(previous.map((s) => s.id));
  const after = new Set(skins.map((s) => s.id));
  const added = skins.filter((s) => !before.has(s.id));
  const removed = previous.filter((s) => !after.has(s.id));

  writeFileSync(skinsPath, JSON.stringify(skins, null, 1) + "\n");
  writeFileSync(
    join(DATA_DIR, "meta.json"),
    JSON.stringify({ source: SOURCE_REPO, commit: sha, file: "public/api/en/skins.json", count: skins.length }, null, 2) +
      "\n",
  );

  console.log(`wrote ${skins.length} skins (+${added.length} / −${removed.length})`);
  for (const s of added.slice(0, 20)) console.log(`  + ${s.name}${s.phase ? ` (${s.phase})` : ""}`);
  for (const s of removed.slice(0, 20)) console.log(`  − ${s.name}${s.phase ? ` (${s.phase})` : ""}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

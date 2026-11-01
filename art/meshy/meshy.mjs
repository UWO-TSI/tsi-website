#!/usr/bin/env node
/**
 * Meshy, the first step of the modelling pipeline (design bible, Models rule 3; David, 2026-10-29 and 2026-11-01:
 * "add meshy.ai as apart of your modeling pipeline, and edits are done on blender"). Meshy makes the starting mesh;
 * every edit after that is a Blender script on it (art/meshy/clean.py first), never a new generation.
 *
 *   node art/meshy/meshy.mjs balance
 *   node art/meshy/meshy.mjs image <name> <ref.png> [<ref2.png> ... up to 4] [--texture "<prompt>"]
 *   node art/meshy/meshy.mjs text <name> "<prompt>" [--texture "<prompt>"]
 *
 * Writes art/meshy/raw/<name>.glb and <name>.png (the thumbnail; raw/ is not in git: Meshy output never ships raw)
 * and appends a line to art/meshy/log.md with the task, the credits and the prompt. The key is read from the macOS
 * keychain ("Meshy API") and never printed. Each run spends David's credits: ask the coordinator past 10 a round.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = join(HERE, "raw");
const API = "https://api.meshy.ai/openapi";

let key;
try { key = execFileSync("security", ["find-generic-password", "-s", "Meshy API", "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
catch { console.error('No "Meshy API" in the keychain. David adds it: security add-generic-password -s "Meshy API" -a meshy -w'); process.exit(1); }

async function call(path, body) {
  const res = await fetch(`${API}${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${res.status} ${json.message ?? JSON.stringify(json)}`);
  return json;
}

/** Polls a task until it ends; returns it, or throws with Meshy's error. */
async function wait(path, id) {
  for (;;) {
    const t = await call(`${path}/${id}`);
    process.stdout.write(`\r${t.status} ${t.progress ?? 0}%   `);
    if (t.status === "SUCCEEDED") { process.stdout.write("\n"); return t; }
    if (t.status === "FAILED" || t.status === "CANCELED") throw new Error(`\n${id} ${t.status}: ${t.task_error?.message ?? ""}`);
    await new Promise(r => setTimeout(r, 5000));
  }
}

const dataUri = file => `data:image/${extname(file).slice(1).replace("jpg", "jpeg")};base64,${readFileSync(file).toString("base64")}`;

async function save(name, task, credits, what) {
  mkdirSync(RAW, { recursive: true });
  const get = async url => Buffer.from(await (await fetch(url)).arrayBuffer());
  writeFileSync(join(RAW, `${name}.glb`), await get(task.model_urls.glb));
  if (task.thumbnail_url) writeFileSync(join(RAW, `${name}.png`), await get(task.thumbnail_url));
  appendFileSync(join(HERE, "log.md"), `| ${new Date().toISOString().slice(0, 10)} | ${name} | ${task.id} | ${credits} | ${what.replace(/\|/g, "/").replace(/\s+/g, " ")} |\n`);
  console.log(`art/meshy/raw/${name}.glb (${credits} credits)`);
}

const [cmd, name, ...rest] = process.argv.slice(2);
const flag = f => { const i = rest.indexOf(f); return i < 0 ? undefined : rest.splice(i, 2)[1]; };
const texture_prompt = flag("--texture");
const MESH = { ai_model: "latest", should_texture: true, target_formats: ["glb"], ...(texture_prompt && { texture_prompt }) };

if (cmd === "balance") console.log((await call("/v1/balance")).balance);
else if (cmd === "image" && name && rest.length >= 1 && rest.length <= 4) {
  const multi = rest.length > 1;
  const path = multi ? "/v1/multi-image-to-3d" : "/v1/image-to-3d";
  const { result } = await call(path, { ...MESH, ...(multi ? { image_urls: rest.map(dataUri) } : { image_url: dataUri(rest[0]) }) });
  const t = await wait(path, result);
  await save(name, t, t.consumed_credits ?? "?", `image: ${rest.join(", ")}${texture_prompt ? `; texture: ${texture_prompt}` : ""}`);
} else if (cmd === "text" && name && rest.length === 1) {
  const path = "/v2/text-to-3d";
  const preview = await wait(path, (await call(path, { mode: "preview", prompt: rest[0], ai_model: "latest", target_formats: ["glb"] })).result);
  const t = await wait(path, (await call(path, { mode: "refine", preview_task_id: preview.id, target_formats: ["glb"], ...(texture_prompt && { texture_prompt }) })).result);
  await save(name, t, `${preview.consumed_credits ?? "?"}+${t.consumed_credits ?? "?"}`, `text: ${rest[0]}${texture_prompt ? `; texture: ${texture_prompt}` : ""}`);
} else {
  console.error("usage: meshy.mjs balance | image <name> <ref.png>... [--texture p] | text <name> \"<prompt>\" [--texture p]");
  process.exit(2);
}

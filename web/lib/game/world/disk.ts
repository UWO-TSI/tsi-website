/**
 * The world files on disk (Node only: the dev save route, the conversion script, the tests). Same loader as the
 * browser's (format.ts); writes go beside each file and rename over it, so a crash mid-save never leaves half a world.
 */
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldCells, worldCellsJson } from "./cells";
import { cellMapOf } from "./terrain";
import { decodeWorld, worldDocProblem, type World, type WorldDoc, type WorldFiles } from "./format";

/** The three files' bytes as they are on disk. */
export function readWorldFiles(dir: string): { doc: WorldDoc; json: string; height: Uint8Array; surface: Uint8Array } {
  const json = readFileSync(join(dir, "world.json"), "utf8"), doc = JSON.parse(json) as WorldDoc;
  const bad = worldDocProblem(doc);
  if (bad) throw new Error(`${join(dir, "world.json")}: ${bad}`);
  return { doc, json, height: new Uint8Array(readFileSync(join(dir, doc.height))), surface: new Uint8Array(readFileSync(join(dir, doc.surface))) };
}

export function loadWorldFromDisk(dir: string): World {
  const f = readWorldFiles(dir);
  return decodeWorld(f.doc, f.height, f.surface);
}

const put = (dir: string, name: string, data: string | Uint8Array) => { const tmp = join(dir, `${name}.saving`); writeFileSync(tmp, data); renameSync(tmp, join(dir, name)); };

/** Write the three files (the images under the names the document gives), then the server's cell view of them. */
export function writeWorldFiles(dir: string, files: WorldFiles): void {
  const doc = JSON.parse(files.json) as WorldDoc;
  put(dir, doc.height, files.height);
  put(dir, doc.surface, files.surface);
  put(dir, "world.json", files.json);
  writeWorldCells(dir);
}

/** The server's cell view (cells.json, world/cells.ts) of the world on disk. Run `scripts/world-cells.ts` after a merge. */
export function writeWorldCells(dir: string): void {
  put(dir, "cells.json", worldCellsJson(worldCells(cellMapOf(loadWorldFromDisk(dir).terrain))));
}

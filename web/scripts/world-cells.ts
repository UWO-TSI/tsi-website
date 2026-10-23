/**
 * Rewrite web/data/world/cells.json (the server's cell view, lib/game/world/cells.ts) from the world files on disk.
 * Every editor save writes it already; run this after a merge touches the world:
 *
 *   cd web && npx vite-node -c vitest.config.ts scripts/world-cells.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeWorldCells } from "../lib/game/world/disk";

writeWorldCells(join(dirname(fileURLToPath(import.meta.url)), "../data/world"));

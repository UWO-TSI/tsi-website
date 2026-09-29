#!/usr/bin/env node
import { restoreFurniture } from "./restore-furniture-assets.mjs";

const selected = process.argv[2] || "all";
if (!["wood", "park", "all"].includes(selected)) throw new Error("Choose wood, park or all");
await restoreFurniture(selected === "all" ? ["wood", "park"] : selected, process.argv[3]);

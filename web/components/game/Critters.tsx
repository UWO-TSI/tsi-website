"use client";

/**
 * Critter species (gameplay pillar: critters & collection, v1 — 2026-07-12):
 * the ACNH bug and shore-crab models the island's peaceful loop spawns
 * (peaceful/VillageLife). Collection is persisted via POST /api/collections.
 */

import { useGLTF } from "@react-three/drei";

type Motion = "flutter" | "dart" | "perch" | "drift" | "crawl";

export interface Species {
  key: string;
  label: string;
  model: string;
  motion: Motion;
  scale: number;
  baseY: number;
  phases: ("day" | "night")[];
  weight: number;
  /** Shore critters (2026-07-15) anchor to the beach band, not flowers. */
  zone?: "beach";
}

export const SPECIES: Species[] = [
  { key: "bug_common_butterfly", label: "a Common Butterfly", model: "/assets/acnh/critters/common-butterfly.glb", motion: "flutter", scale: 0.09, baseY: 0.75, phases: ["day"], weight: 3 },
  { key: "bug_agrias_butterfly", label: "an Agrias Butterfly", model: "/assets/acnh/critters/agrias-butterfly.glb", motion: "flutter", scale: 0.09, baseY: 0.8, phases: ["day"], weight: 2 },
  { key: "bug_emperor_butterfly", label: "an Emperor Butterfly", model: "/assets/acnh/critters/emperor-butterfly.glb", motion: "flutter", scale: 0.09, baseY: 0.85, phases: ["night"], weight: 1 },
  { key: "bug_darner_dragonfly", label: "a Darner Dragonfly", model: "/assets/acnh/critters/darner-dragonfly.glb", motion: "dart", scale: 0.09, baseY: 0.55, phases: ["day"], weight: 2 },
  { key: "bug_ladybug", label: "a Ladybug", model: "/assets/acnh/critters/ladybug.glb", motion: "crawl", scale: 0.13, baseY: 0.06, phases: ["day"], weight: 2 },
  { key: "bug_brown_cicada", label: "a Brown Cicada", model: "/assets/acnh/critters/brown-cicada.glb", motion: "perch", scale: 0.1, baseY: 1.45, phases: ["day"], weight: 2 },
  { key: "bug_firefly", label: "a Firefly", model: "/assets/acnh/critters/firefly.glb", motion: "drift", scale: 0.1, baseY: 0.6, phases: ["night"], weight: 3 },
  // Species drop 2 (2026-07-13): monthly-cadence content, principle #8.
  { key: "bug_monarch_butterfly", label: "a Monarch Butterfly", model: "/assets/acnh/critters/monarch-butterfly.glb", motion: "flutter", scale: 0.09, baseY: 0.78, phases: ["day"], weight: 2 },
  { key: "bug_tiger_butterfly", label: "a Tiger Butterfly", model: "/assets/acnh/critters/tiger-butterfly.glb", motion: "flutter", scale: 0.09, baseY: 0.82, phases: ["day"], weight: 2 },
  { key: "bug_peacock_butterfly", label: "a Peacock Butterfly", model: "/assets/acnh/critters/peacock-butterfly.glb", motion: "flutter", scale: 0.09, baseY: 0.8, phases: ["night"], weight: 2 },
  { key: "bug_red_dragonfly", label: "a Red Dragonfly", model: "/assets/acnh/critters/red-dragonfly.glb", motion: "dart", scale: 0.09, baseY: 0.5, phases: ["day"], weight: 2 },
  { key: "bug_mantis", label: "a Mantis", model: "/assets/acnh/critters/mantis.glb", motion: "crawl", scale: 0.11, baseY: 0.06, phases: ["day"], weight: 1 },
  { key: "bug_grasshopper", label: "a Grasshopper", model: "/assets/acnh/critters/grasshopper.glb", motion: "crawl", scale: 0.11, baseY: 0.06, phases: ["day"], weight: 2 },
  // Shore critters v1 (2026-07-15): catchable crabs on the beach band —
  // models ship PRE-scaled from the beach pipeline (scale 1 here).
  { key: "shore_gazami_crab", label: "a Gazami Crab", model: "/assets/acnh/props/crab-gazami.glb", motion: "crawl", scale: 1, baseY: 0.03, phases: ["day"], weight: 2, zone: "beach" },
  { key: "shore_hermit_crab", label: "a Hermit Crab", model: "/assets/acnh/props/crab-hermit.glb", motion: "crawl", scale: 1, baseY: 0.03, phases: ["day", "night"], weight: 2, zone: "beach" },
];
SPECIES.forEach((s) => useGLTF.preload(s.model));

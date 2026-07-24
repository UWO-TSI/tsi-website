"use client";

/**
 * Critters (gameplay pillar: critters & collection, v1 — 2026-07-12).
 *
 * Live insects populate the island from the real ACNH models: butterflies
 * flutter over flower clusters, a dragonfly darts along the river, cicadas
 * perch on trunks, fireflies drift at night. Six spawn slots roll a
 * seeded daily species pick per time-of-day phase; walking close offers
 * "Catch …" through the central E sweep (via critterStore) and a catch
 * arcs the critter to the player with a toast — collection is cosmetic
 * only, zero TC/XP (principle #3), persisted via POST /api/collections
 * like flowers/fruit/fish. Caught slots respawn after ~90s at a new
 * anchor so the island never runs dry.
 *
 * All per-frame state lives in refs/module scratch (react-compiler-safe);
 * seeds are mulberry32 so every player sees the same critters on the same
 * day.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { sampleTerrainHeightFast } from "./terrain";
import { setActiveCritters, todayCritterSeed, type ActiveCritter } from "@/lib/game/critterStore";
import { AudioManager } from "@/lib/game/audio";
import confetti from "canvas-confetti";
import { collect, localCollections } from "@/lib/game/collections";

type Motion = "flutter" | "dart" | "perch" | "drift" | "crawl";

interface Species {
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

const SPECIES: Species[] = [
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

const SLOTS = 6;
const CATCH_ANIM_S = 0.6;
const RESPAWN_MS = 90000;

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Spawn {
  slot: number;
  sp: Species;
  anchor: [number, number]; // XZ
  aux: [number, number]; // second point for dart runs
  seed: number;
  caughtAt: number | null; // performance.now() when caught, null = active
  catching: boolean; // catch anim in flight
}

function buildSpawns(
  dayKey: number,
  phase: "day" | "night",
  flowerAnchors: readonly [number, number][],
  treeAnchors: readonly [number, number][],
): Spawn[] {
  const rnd = mulberry32(dayKey * 7 + (phase === "day" ? 1 : 5));
  const pool = SPECIES.filter((s) => s.phases.includes(phase));
  const totalW = pool.reduce((a, s) => a + s.weight, 0);
  const spawns: Spawn[] = [];
  // river-adjacent anchor band for dart/drift species
  const riverAnchors: [number, number][] = [[-12, 6.5], [-4, 0.4], [6, 6.2], [17, 1.8], [28, 6.4]];
  // dry-sand anchors for shore critters (coast-v2 verified: e ≈ 48.4-49.4)
  const beachAnchors: [number, number][] = [[13, 46], [17, 44.5], [38, -19.5], [-18, 40]];
  for (let i = 0; i < SLOTS; i++) {
    let roll = rnd() * totalW;
    let sp = pool[0];
    for (const s of pool) { roll -= s.weight; if (roll <= 0) { sp = s; break; } }
    let anchor: [number, number];
    if (sp.zone === "beach") {
      anchor = beachAnchors[Math.floor(rnd() * beachAnchors.length)];
    } else if (sp.motion === "perch") {
      anchor = treeAnchors[Math.floor(rnd() * treeAnchors.length)];
    } else if (sp.motion === "dart" || sp.motion === "drift") {
      anchor = riverAnchors[Math.floor(rnd() * riverAnchors.length)];
    } else {
      anchor = flowerAnchors[Math.floor(rnd() * flowerAnchors.length)];
    }
    const aux: [number, number] = [anchor[0] + (rnd() - 0.5) * 7, anchor[1] + (rnd() - 0.5) * 5];
    spawns.push({ slot: i, sp, anchor, aux, seed: Math.floor(rnd() * 1000), caughtAt: null, catching: false });
  }
  return spawns;
}

function CritterModel({ url, scale }: { url: string; scale: number }) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={clone} scale={[scale, scale, scale]} />;
}

const _catch = new THREE.Vector3();

// Mutable frame state lives at module scope (flowerPicks pattern): both the
// frame loop and the window catch-handler mutate it, and module variables
// sit outside the react-compiler's effect-immutability tracking entirely.
const frameState: { source: Spawn[] | null; spawns: Spawn[] | null } = { source: null, spawns: null };
// Reused registry buffer — rebuilding this array with fresh objects every
// frame was 60Hz GC churn (perf pass 2026-07-13).
const _live: ActiveCritter[] = [];

export default function Critters({
  todPhase,
  playerPosRef,
  flowerAnchors,
  treeAnchors,
}: {
  todPhase: "day" | "night" | "dawn" | "dusk";
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  flowerAnchors: readonly [number, number][];
  treeAnchors: readonly [number, number][];
}) {
  const phase: "day" | "night" = todPhase === "night" || todPhase === "dusk" ? "night" : "day";
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const catchStartRef = useRef<number[]>(new Array(SLOTS).fill(0));
  const [dayKey] = useState(() => todayCritterSeed());

  // One deterministic roll drives BOTH the render mount (frozen memo) and
  // the frame loop's mutable state (clones in a ref — the react-compiler
  // freezes useMemo results, so useFrame must never mutate them directly).
  const spawnsForRender = useMemo(
    () => buildSpawns(dayKey, phase, flowerAnchors, treeAnchors),
    [dayKey, phase, flowerAnchors, treeAnchors],
  );

  // Catch events from the central E handler.
  useEffect(() => {
    const onCatch = (e: Event) => {
      const { slot } = (e as CustomEvent<{ slot: number }>).detail;
      const sp = frameState.spawns?.[slot];
      if (!sp || sp.caughtAt !== null || sp.catching) return;
      sp.catching = true;
      catchStartRef.current[slot] = performance.now();
      AudioManager.playSFX("confirm");
      // Loop iter 11 (2026-07-24): first catches feel different — NEW!
      // toast, a cozy confetti pinch, and a two-note flourish. Repeats
      // keep the quiet toast (ACNH restraint).
      const isNew = !(sp.sp.key in localCollections());
      if (isNew) {
        confetti({ particleCount: 18, spread: 48, startVelocity: 26, origin: { x: 0.5, y: 0.74 }, colors: ["#7C9A62", "#FFD166", "#FFFDF5"], disableForReducedMotion: true });
        window.setTimeout(() => AudioManager.playSFX("blip3"), 140);
      }
      window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: `${isNew ? "NEW! " : ""}You caught ${sp.sp.label}!`, icon: `/assets/acnh/icons/${sp.sp.key}.png` } }));
      collect(sp.sp.key);
    };
    window.addEventListener("tsi:critter-catch", onCatch);
    return () => window.removeEventListener("tsi:critter-catch", onCatch);
  }, []);

  useFrame(() => {
    // Clone the frozen memo into the module frame state lazily.
    if (frameState.source !== spawnsForRender) {
      frameState.source = spawnsForRender;
      frameState.spawns = spawnsForRender.map((sp) => ({ ...sp }));
    }
    const spawns = frameState.spawns;
    if (!spawns) return;
    const now = performance.now();
    const t = now / 1000;
    const pp = playerPosRef.current;
    _live.length = 0;

    for (const s of spawns) {
      const g = groupRefs.current[s.slot];
      if (!g) continue;

      // Respawn cycle
      if (s.caughtAt !== null) {
        if (now - s.caughtAt > RESPAWN_MS) {
          s.caughtAt = null;
          s.catching = false;
        } else {
          g.visible = false;
          continue;
        }
      }

      const [ax, az] = s.anchor;
      const ph = s.seed * 0.7;
      let x = ax, z = az, y = s.sp.baseY, ry = 0;

      switch (s.sp.motion) {
        case "flutter": {
          x = ax + Math.sin(t * 0.7 + ph) * 1.25;
          z = az + Math.cos(t * 0.55 + ph * 1.3) * 1.1;
          y = s.sp.baseY + Math.sin(t * 2.3 + ph) * 0.22;
          ry = Math.atan2(Math.cos(t * 0.7 + ph), -Math.sin(t * 0.55 + ph * 1.3));
          break;
        }
        case "dart": {
          const k = (Math.sin(t * 0.5 + ph) + 1) / 2;
          const ke = k * k * (3 - 2 * k);
          x = ax + (s.aux[0] - ax) * ke;
          z = az + (s.aux[1] - az) * ke;
          y = s.sp.baseY + Math.sin(t * 6 + ph) * 0.05;
          ry = Math.atan2(s.aux[0] - ax, s.aux[1] - az) + (Math.cos(t * 0.5 + ph) < 0 ? Math.PI : 0);
          break;
        }
        case "perch": {
          x = ax + 0.42; z = az; y = s.sp.baseY;
          ry = Math.PI / 2;
          break;
        }
        case "drift": {
          x = ax + Math.sin(t * 0.3 + ph) * 2.2;
          z = az + Math.cos(t * 0.24 + ph) * 1.6;
          y = s.sp.baseY + Math.sin(t * 1.1 + ph) * 0.18;
          break;
        }
        case "crawl": {
          x = ax + Math.sin(t * 0.16 + ph) * 0.8;
          z = az + Math.cos(t * 0.16 + ph) * 0.8;
          y = 0.06;
          ry = -(t * 0.16 + ph);
          break;
        }
      }

      const ground = sampleTerrainHeightFast(x, z);
      let py = ground + y;
      let scl = s.sp.scale;

      // Catch animation: arc into the player and shrink.
      if (s.catching) {
        const k = Math.min((now - catchStartRef.current[s.slot]) / (CATCH_ANIM_S * 1000), 1);
        const ke = k * k * (3 - 2 * k);
        _catch.set(pp.x, pp.y + 0.9, pp.z);
        x = x + (_catch.x - x) * ke;
        py = py + (_catch.y - py) * ke;
        z = z + (_catch.z - z) * ke;
        scl = s.sp.scale * (1 - ke * 0.75);
        if (k >= 1) {
          s.caughtAt = now;
          s.catching = false;
        }
      }

      g.visible = true;
      g.position.set(x, py, z);
      g.rotation.y = ry;
      g.scale.setScalar(scl);

      if (!s.catching && s.caughtAt === null) {
        _live.push({ slot: s.slot, key: s.sp.key, label: s.sp.label, x, z });
      }
    }
    setActiveCritters(_live);
  });

  return (
    <>
      {spawnsForRender.map((s) => (
        <group key={`${phase}-${s.slot}`} ref={(el) => { groupRefs.current[s.slot] = el; }} visible={false}>
          <Suspense fallback={null}>
            <CritterModel url={s.sp.model} scale={s.sp.scale} />
          </Suspense>
          {s.sp.motion === "drift" && (
            <sprite scale={[0.55, 0.55, 1]}>
              <spriteMaterial color="#D8FF9E" transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
            </sprite>
          )}
        </group>
      ))}
    </>
  );
}

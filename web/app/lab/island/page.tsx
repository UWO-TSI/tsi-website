"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PAINTER_DRAFT_KEY, parseVillage, setVillageDoc, type VillageDoc } from "@/lib/game/villageMap";
import { PROPOSALS, acceptProposed } from "@/lib/game/proposals";
import { terrainFixtureDoc } from "@/lib/game/fixtures/terrainFixture";
import { terrainV2DraftDoc } from "@/lib/game/fixtures/terrainV2Draft";
import { setVillage } from "@/lib/game/villageMap";
import { loadShippedWorld } from "@/lib/game/world/load";
import { villageOfWorld } from "@/lib/game/world/village";
import { saveOrbit, snapBack, turnQuarter } from "@/lib/game/orbitCamera";

const DefaultIslandWorld = dynamic(() => import("@/components/game/DefaultIslandWorld"), {
  ssr: false,
  loading: () => <p style={{ padding: 32 }}>Preparing Tethos Island…</p>,
});

/**
 * The member island bench. `?draft=1` walks the /lab/map painter's working
 * draft (its autosave in this browser) instead of the shipped village file
 * (`?fixture=terrain`: the synthetic natural-terrain test island):
 * the document is swapped in before the world mounts, and every system reads
 * the village from it (specs/island-painter.md §8). Nothing is written back.
 * The draft banner steps the camera a quarter turn round (specs/camera-orbit.md
 * §6) so David can check the design from every side; the mouse, the arrows and
 * the dev panel's overview turn it too. The default is the game view (west).
 */
const TURN = { marginLeft: 6, padding: "2px 8px", borderRadius: 4, border: "1px solid #7fd1c0", background: "transparent", color: "#7fd1c0", font: "inherit", cursor: "pointer" } as const;

export default function IslandBench() {
  const [mode, setMode] = useState<"shipped" | "draft" | "no-draft" | "world" | null>(null);
  // localStorage is an external store; read once after mount (this page server-renders).
  useEffect(() => {
    let next: "shipped" | "draft" | "no-draft" = "shipped";
    try {
      const query = new URLSearchParams(window.location.search);
      // The natural-terrain test island (lib/game/fixtures/terrainFixture.ts), never the shipped one.
      if (query.get("fixture") === "terrain") setVillageDoc(terrainFixtureDoc());
      // The v2 world as the world editor's smooth heightfield (web/data/world/, specs/world-editor.md), loaded before the
      // world mounts. `&proposals=1` walks it with the placement proposals accepted (lib/game/proposals.ts).
      else if (query.get("fixture") === "v2") {
        const proposals = query.get("proposals") === "1";
        void loadShippedWorld().then((w) => {
          const objects = proposals ? acceptProposed(w.objects, PROPOSALS.filter(p => p.target === "world-map").flatMap(p => p.objects)) : w.objects;
          setVillage(villageOfWorld({ terrain: w.terrain, objects }));
          setMode("world");
        });
        return;
      }
      // The same world as the cell draft it was converted from (web/data/world-map.json, kept until David accepts the new one).
      else if (query.get("fixture") === "v2-cells") {
        const doc = terrainV2DraftDoc();
        setVillageDoc(query.get("proposals") === "1" ? { ...doc, objects: acceptProposed(parseVillage(doc).objects, PROPOSALS.filter(p => p.target === "world-map").flatMap(p => p.objects)) } : doc);
      }
      else if (query.get("draft") === "1") {
        const raw = window.localStorage.getItem(PAINTER_DRAFT_KEY);
        if (raw) setVillageDoc(JSON.parse(raw) as VillageDoc);
        next = raw ? "draft" : "no-draft";
      }
    } catch {
      next = "no-draft"; // unreadable draft: the shipped island
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is read once after mount; the draft must be set before the world mounts
    setMode(next);
  }, []);
  if (!mode) return null;
  return <>
    {mode !== "shipped" && <p role="status" style={{ position: "fixed", top: 48, left: "50%", transform: "translateX(-50%)", zIndex: 150, margin: 0, padding: "6px 12px", borderRadius: 6,
      background: "rgba(11,14,20,0.85)", color: "#ffd166", font: "12px ui-monospace, Menlo, monospace" }}>
      {mode === "world" ? "Walking the smooth world (web/data/world)" : mode === "draft" ? "Walking the painter's draft" : "No painter draft in this browser: showing the shipped island"} · <Link href="/lab/map" style={{ color: "#7fd1c0" }}>back to the painter</Link>
      {" · "}<button style={TURN} onClick={() => { turnQuarter(1); saveOrbit(); }}>⟲ Turn left</button>
      <button style={TURN} onClick={() => { turnQuarter(-1); saveOrbit(); }}>Turn right ⟳</button>
      <button style={TURN} onClick={() => { snapBack(); saveOrbit(); }}>Game view</button>
    </p>}
    <DefaultIslandWorld />
  </>;
}

"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PAINTER_DRAFT_KEY, setVillageDoc, type VillageDoc } from "@/lib/game/villageMap";
import { terrainFixtureDoc } from "@/lib/game/fixtures/terrainFixture";

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
 */
export default function IslandBench() {
  const [mode, setMode] = useState<"shipped" | "draft" | "no-draft" | null>(null);
  // localStorage is an external store; read once after mount (this page server-renders).
  useEffect(() => {
    let next: "shipped" | "draft" | "no-draft" = "shipped";
    try {
      const query = new URLSearchParams(window.location.search);
      // The natural-terrain test island (lib/game/fixtures/terrainFixture.ts), never the shipped one.
      if (query.get("fixture") === "terrain") setVillageDoc(terrainFixtureDoc());
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
      {mode === "draft" ? "Walking the painter's draft" : "No painter draft in this browser: showing the shipped island"} · <Link href="/lab/map" style={{ color: "#7fd1c0" }}>back to the painter</Link>
    </p>}
    <DefaultIslandWorld />
  </>;
}

"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { setVillageDoc } from "@/lib/game/villageMap";
import { terrainFixtureDoc } from "@/lib/game/fixtures/terrainFixture";

const DefaultIslandWorld = dynamic(() => import("@/components/game/DefaultIslandWorld"), {
  ssr: false,
  loading: () => <p style={{ padding: 32 }}>Preparing Tethos Island…</p>,
});

/**
 * The member island bench: the game's island (the new world, web/data/world) with the lab's switches. `?fixture=terrain`
 * walks the synthetic natural-terrain test island (lib/game/fixtures/terrainFixture.ts) instead, swapped in before the
 * world mounts. Nothing is written back.
 */
export default function IslandBench() {
  const [ready, setReady] = useState(false);
  // The query is read once after mount (this page server-renders); the fixture must be set before the world mounts.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("fixture") === "terrain") setVillageDoc(terrainFixtureDoc());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the fixture is swapped in once after mount, before the world mounts
    setReady(true);
  }, []);
  return ready ? <DefaultIslandWorld /> : null;
}

"use client";

/**
 * /lab/world — the real island with experiment knobs (2026-07-22).
 *
 * Mounts the actual GameWorld (no replica) plus LabPanel. Live knobs flow
 * through the devLab store; weather/spawn knobs bump `worldKey` so the
 * world remounts and re-reads its existing URL-param QA hooks.
 */

import { useState } from "react";
import dynamic from "next/dynamic";
import LabPanel from "@/components/lab/LabPanel";

const GameWorld = dynamic(() => import("@/components/game/GameWorld"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "calc(100vh - 40px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'IBM Plex Mono', monospace",
        color: "#8a939a",
      }}
    >
      loading world bench…
    </div>
  ),
});

export default function WorldBench() {
  const [worldKey, setWorldKey] = useState(0);
  return (
    <div style={{ position: "relative", width: "100%", height: "calc(100vh - 40px)", overflow: "hidden" }}>
      <GameWorld key={worldKey} />
      <LabPanel onRemount={() => setWorldKey((k) => k + 1)} />
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/**
 * /lab/world: the world editor (specs/world-editor.md). Dev only: the lab layout 404s it in production.
 *
 * The editor draws the world FLAT (no curved-world bend: `?aerial=1`, read once by lib/game/curvedWorld.ts when it
 * first loads), so the crosshair lands where it points and the overhead view is a true map. The game's own walk
 * (/lab/island?fixture=v2) shows it bent. The URL is set before the editor's code loads.
 */
const WorldEditor = dynamic(() => import("@/components/game/world/editor/WorldEditor"), { ssr: false, loading: () => <p style={{ padding: 32 }}>Loading the editor…</p> });

export default function WorldEditorPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("aerial") !== "1") { q.set("aerial", "1"); window.history.replaceState(null, "", `?${q}`); }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the flag must be in the URL before the editor's modules evaluate
    setReady(true);
  }, []);
  return ready ? <WorldEditor /> : null;
}

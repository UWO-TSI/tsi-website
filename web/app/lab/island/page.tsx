"use client";

import dynamic from "next/dynamic";

const DefaultIslandWorld = dynamic(() => import("@/components/game/DefaultIslandWorld"), {
  ssr: false,
  loading: () => <p style={{ padding: 32 }}>Preparing Tethos Island…</p>,
});

export default function IslandBench() {
  return <DefaultIslandWorld />;
}

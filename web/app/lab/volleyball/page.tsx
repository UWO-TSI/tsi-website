"use client";

import dynamic from "next/dynamic";

const VolleyLab = dynamic(() => import("@/components/game/volleyball/VolleyLab"), {
  ssr: false,
  loading: () => <p style={{ padding: 32 }}>Raking the sand…</p>,
});

/** The volleyball lab (specs/minigames/beach-volleyball.md): the match on a court of its own, for testing and evidence. */
export default function VolleyBench() {
  return <VolleyLab />;
}

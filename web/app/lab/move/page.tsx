"use client";

import dynamic from "next/dynamic";

const MoveLab = dynamic(() => import("@/components/game/movement/MoveLab"), {
  ssr: false,
  loading: () => <p style={{ padding: 32 }}>Building the movement course…</p>,
});

/** The movement lab (specs/movement.md): the test course, the sim, the tuning panel. */
export default function MoveBench() {
  return <MoveLab />;
}

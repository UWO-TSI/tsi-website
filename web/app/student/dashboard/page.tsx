"use client";

import dynamic from "next/dynamic";

const GameWorld = dynamic(() => import("@/components/game/GameWorld"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: "var(--color-bg-main)" }}
    >
      <div className="text-center">
        <pre
          className="font-mono text-xs mb-4 select-none"
          style={{ color: "var(--color-text-subtle)", opacity: 0.6 }}
        >
{`  ████████████████████
  █ LOADING WORLD... █
  ████████████████████`}
        </pre>
        <div
          className="w-48 h-1.5 rounded-full mx-auto overflow-hidden"
          style={{ background: "var(--gray-800)" }}
        >
          <div
            className="h-full rounded-full animate-pulse"
            style={{
              width: "60%",
              background: "var(--color-brand-blue)",
            }}
          />
        </div>
      </div>
    </div>
  ),
});

export default function DashboardHome() {
  return (
    <div className="w-full h-full">
      <GameWorld />
    </div>
  );
}

"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

/**
 * Sprint A9: branded loading state for the canvas mount.
 *
 * Used twice:
 *   1. next/dynamic `loading` — fires while the GameWorld chunk downloads
 *   2. React <Suspense fallback> — fires while any Suspense-throwing async
 *      resource inside GameWorld (GLBs via useGLTF, etc.) resolves
 *
 * Pure HTML/CSS: no R3F, no GLBs, no images. Keeps first paint cheap.
 * Matches the existing ASCII aesthetic of the marketing site
 * (web/components/ascii/*) without pulling in gsap/ScrollTrigger.
 */
function GameLoadingScreen() {
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: "var(--color-bg-main)" }}
    >
      <div className="text-center">
        <pre
          className="font-mono text-xs mb-4 select-none"
          style={{ color: "var(--color-text-subtle)", opacity: 0.6 }}
          aria-hidden="true"
        >
{`  ████████████████████
  █ LOADING WORLD... █
  ████████████████████`}
        </pre>
        <div
          className="font-mono text-sm mb-4 select-none"
          style={{ color: "var(--color-text-muted)" }}
        >
          Connecting to TSI World
          <span className="a9-cursor">_</span>
        </div>
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
      <style jsx>{`
        .a9-cursor {
          display: inline-block;
          margin-left: 2px;
          animation: a9-blink 1s steps(2, start) infinite;
        }
        @keyframes a9-blink {
          to {
            visibility: hidden;
          }
        }
      `}</style>
    </div>
  );
}

const GameWorld = dynamic(() => import("@/components/game/GameWorld"), {
  ssr: false,
  loading: () => <GameLoadingScreen />,
});

export default function DashboardHome() {
  return (
    <div className="w-full h-full">
      <Suspense fallback={<GameLoadingScreen />}>
        <GameWorld />
      </Suspense>
    </div>
  );
}

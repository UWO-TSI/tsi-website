"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PEOPLE } from "@/components/site/marks";

const SEEN = "tethos-loaded";
// Around the ring from the top, clockwise.
const ORDER = [5, 2, 3, 4, 0, 1];
const STEP = 60;
const ASSEMBLE = ORDER.length * STEP + 200;
const HOLD = 120;
const LIFT = 420;

/**
 * The loading screen (specs/site/revamp.md): the six people of the mark arrive one by one on black,
 * then the screen lifts away. Under a second, once per visit; reduced motion skips it.
 */
export default function LoadingScreen() {
  // The applicant island, the member island (/student/dashboard) and the portal's title screen (/student) have their own.
  const recruitment = /^\/student(\/(apply|dashboard\/?$)|\/?$)/.test(usePathname());
  const [phase, setPhase] = useState<"assemble" | "lift" | "gone">("assemble");

  useEffect(() => {
    if (recruitment) return;
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN) === "1"; sessionStorage.setItem(SEEN, "1"); } catch {}
    if (seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const skip = setTimeout(() => setPhase("gone"), 0);
      return () => clearTimeout(skip);
    }
    const lift = setTimeout(() => setPhase("lift"), ASSEMBLE + HOLD);
    const gone = setTimeout(() => setPhase("gone"), ASSEMBLE + HOLD + LIFT);
    return () => { clearTimeout(lift); clearTimeout(gone); };
  }, [recruitment]);

  if (recruitment || phase === "gone") return null;

  return (
    <div
      aria-hidden="true"
      data-ts-loader=""
      style={{
        position: "fixed", inset: 0, zIndex: 100, background: "#0f0f10", display: "flex", alignItems: "center", justifyContent: "center",
        transform: phase === "lift" ? "translateY(-100%)" : "none",
        transition: `transform ${LIFT}ms cubic-bezier(0.7, 0, 0.3, 1)`,
      }}
    >
      {/* A returning visitor never sees it: a head rule hides it before first paint (React leaves extra head nodes alone), then the effect removes it. */}
      <script dangerouslySetInnerHTML={{ __html: `try{if(sessionStorage.getItem("${SEEN}")==="1"||matchMedia("(prefers-reduced-motion: reduce)").matches)document.head.insertAdjacentHTML("beforeend","<style>[data-ts-loader]{display:none!important}</style>")}catch(e){}` }} />
      <style>{`@keyframes tethos-arrive{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:none}}`}</style>
      <svg width="64" height="62" viewBox="0 0 1410 1352" fill="#f1ffff">
        {PEOPLE.map((p, i) => (
          <path
            key={i}
            d={p.d}
            fillRule={p.evenodd ? "evenodd" : undefined}
            style={{ opacity: 0, transformBox: "fill-box", transformOrigin: "center", animation: `tethos-arrive 200ms cubic-bezier(0.25,1,0.5,1) ${ORDER.indexOf(i) * STEP}ms forwards` }}
          />
        ))}
      </svg>
    </div>
  );
}

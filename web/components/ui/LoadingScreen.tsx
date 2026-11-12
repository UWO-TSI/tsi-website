"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { PEOPLE } from "@/components/site/marks";

const SEEN = "tethos-loaded";
// Around the ring from the top, clockwise.
const ORDER = [5, 2, 3, 4, 0, 1];
const STEP = 60;
// It waits for the mark to assemble and breathe once, the fonts and the page's load event (at most MAX_MS), then clicks.
const MIN_MS = ORDER.length * STEP + 700;
const MAX_MS = 5000;
const CLICK_MS = 560;
const LIFT_MS = 440;
// The game's UI click (Kenney, CC0), as mp3 so every browser plays it.
const CLICK_SRC = "/audio/sfx/click.mp3";
const SPRAY = "*+#01@%&<>/=:";
const SPRAY_N = 24;

/**
 * The loading screen (David, 2026-11-12: "just the logo, centred, simple"): on black, the Tethos mark alone in the
 * middle, its six people arriving one by one and then breathing slowly while the page loads (fonts, then the load
 * event, at most MAX_MS). When the page is ready the mark clicks: it presses in, plays the game's UI click, turns
 * blue, sprays characters and sends two rings out, then the black lifts. Once per visit; reduced motion skips it.
 * Browsers may hold back the sound until the visitor has interacted with the site.
 */
export default function LoadingScreen() {
  // The applicant island, the member island (/student/dashboard) and the portal's title screen (/student) have their own.
  const recruitment = /^\/student(\/(apply|dashboard\/?$)|\/?$)/.test(usePathname());
  const [phase, setPhase] = useState<"loading" | "click" | "lift" | "gone">("loading");
  const mark = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (recruitment) return;
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN) === "1"; sessionStorage.setItem(SEEN, "1"); } catch {}
    if (seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const skip = setTimeout(() => setPhase("gone"), 0);
      return () => clearTimeout(skip);
    }

    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => { timers.push(window.setTimeout(fn, ms)); };
    const t0 = performance.now();
    const audio = new Audio(CLICK_SRC);
    audio.preload = "auto";
    audio.volume = 0.55;
    let fonts = false, loaded = document.readyState === "complete", done = false;

    // Blue characters thrown out of the mark, the way a click on the site sprays them.
    const spray = () => {
      const r = mark.current?.getBoundingClientRect();
      if (!r) return;
      const burst = document.createElement("div");
      burst.className = "tl-burst";
      burst.style.left = `${r.left + r.width / 2}px`;
      burst.style.top = `${r.top + r.height / 2}px`;
      for (let i = 0; i < SPRAY_N; i++) {
        const s = document.createElement("span");
        const a = (i / SPRAY_N) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const d = 90 + Math.random() * 110;
        s.textContent = SPRAY[Math.floor(Math.random() * SPRAY.length)];
        s.style.setProperty("--dx", `${(Math.cos(a) * d * 1.4).toFixed(1)}px`);
        s.style.setProperty("--dy", `${(Math.sin(a) * d).toFixed(1)}px`);
        s.style.setProperty("--d", `${Math.round(Math.random() * 60)}ms`);
        s.style.setProperty("--t", `${Math.round(520 + Math.random() * 260)}ms`);
        burst.appendChild(s);
      }
      document.body.appendChild(burst);
      later(() => burst.remove(), 1000);
    };

    const finish = () => {
      if (done) return;
      done = true;
      later(() => {
        setPhase("click");
        audio.play().catch(() => {});
        spray();
        later(() => setPhase("lift"), CLICK_MS);
        later(() => setPhase("gone"), CLICK_MS + LIFT_MS);
      }, Math.max(0, MIN_MS - (performance.now() - t0)));
    };

    const update = () => { if (fonts && loaded) finish(); };
    const onLoad = () => { loaded = true; update(); };
    window.addEventListener("load", onLoad);
    if (document.fonts) document.fonts.ready.then(() => { fonts = true; update(); }, () => { fonts = true; update(); });
    else fonts = true;
    update();
    later(() => { fonts = true; loaded = true; update(); }, MAX_MS);

    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("load", onLoad);
    };
  }, [recruitment]);

  if (recruitment || phase === "gone") return null;

  return (
    <div aria-hidden="true" data-ts-loader="" data-phase={phase}>
      {/* A returning visitor never sees it: a head rule hides it before first paint (React leaves extra head nodes alone), then the effect removes it. */}
      <script dangerouslySetInnerHTML={{ __html: `try{if(sessionStorage.getItem("${SEEN}")==="1"||matchMedia("(prefers-reduced-motion: reduce)").matches)document.head.insertAdjacentHTML("beforeend","<style>[data-ts-loader]{display:none!important}</style>")}catch(e){}` }} />
      <style>{CSS}</style>
      <span className="tl-ring" />
      <span className="tl-ring tl-ring--late" />
      <svg ref={mark} className="tl-mark" viewBox="0 0 1410 1352">
        {PEOPLE.map((p, i) => (
          <path key={i} d={p.d} fillRule={p.evenodd ? "evenodd" : undefined} style={{ animationDelay: `${ORDER.indexOf(i) * STEP}ms` }} />
        ))}
      </svg>
    </div>
  );
}

const CSS = `
[data-ts-loader]{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:#0f0f10;transition:transform ${LIFT_MS}ms cubic-bezier(.7,0,.3,1)}
[data-ts-loader][data-phase=lift]{transform:translateY(-100%)}
.tl-mark{position:relative;z-index:1;width:72px;height:69px;fill:#f1ffff;transition:fill .2s ease}
.tl-mark path{opacity:0;transform-box:fill-box;transform-origin:center;animation:tl-arrive .22s cubic-bezier(.25,1,.5,1) forwards}
@keyframes tl-arrive{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:none}}
[data-phase=loading] .tl-mark{animation:tl-breathe 3.2s ease-in-out .6s infinite}
@keyframes tl-breathe{50%{opacity:.55}}
[data-phase=click] .tl-mark{fill:#1d9bf0;animation:tl-press .42s cubic-bezier(.34,1.56,.64,1)}
[data-phase=lift] .tl-mark{fill:#1d9bf0}
@keyframes tl-press{30%{transform:scale(.86)}}
.tl-ring{position:absolute;left:50%;top:50%;width:240px;height:240px;margin:-120px 0 0 -120px;border-radius:50%;border:1px solid rgba(29,155,240,.7);opacity:0;pointer-events:none}
[data-phase=click] .tl-ring{animation:tl-ring .8s cubic-bezier(.15,.75,.3,1) forwards}
[data-phase=click] .tl-ring--late{animation-delay:.12s;border-color:rgba(29,155,240,.4)}
@keyframes tl-ring{0%{opacity:.9;transform:scale(.25)}100%{opacity:0;transform:scale(2.6)}}
.tl-burst{position:fixed;z-index:101;pointer-events:none;width:0;height:0;font:600 12px "Sohne Mono",ui-monospace,monospace;color:#1d9bf0}
.tl-burst span{position:absolute;left:-3px;top:-7px;opacity:0;animation:tl-burst var(--t) cubic-bezier(.15,.75,.3,1) var(--d) forwards}
@keyframes tl-burst{0%{transform:translate(0,0) scale(1.2);opacity:1}55%{transform:translate(calc(var(--dx)*.8),calc(var(--dy)*.8 - 4px)) scale(1);opacity:.9}100%{transform:translate(var(--dx),calc(var(--dy) + 14px)) scale(.5);opacity:0}}
`;

"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { PEOPLE } from "@/components/site/marks";

const SEEN = "tethos-loaded";
// Around the ring from the top, clockwise.
const ORDER = [5, 2, 3, 4, 0, 1];
const STEP = 60;
// It waits for the mark to assemble, the fonts and the page's load event (at most MAX_MS), fills the line, then clicks.
const MIN_MS = ORDER.length * STEP + 200;
const MAX_MS = 5000;
const FILL_MS = 400;
const CLICK_MS = 560;
const LIFT_MS = 440;
const LINES = ["Loading the page…", "Setting the type…", "Almost there…"];
// The game's UI click (Kenney, CC0), as mp3 so every browser plays it.
const CLICK_SRC = "/audio/sfx/click.mp3";
const SPRAY = "*+#01@%&<>/=:";
const SPRAY_N = 24;

/**
 * The loading screen, after the game's (components/game/IslandLoading): on black, one small dark card with the Tethos
 * mark assembling person by person, the stage it waits on, and a line filled by the real progress (fonts, then the
 * page's load event; it creeps while it waits and never goes back). When the page is ready the card clicks: it
 * presses in, plays the game's click, sprays blue characters and sends two rings out, then the black lifts away.
 * Once per visit; reduced motion skips it. Browsers may hold back the sound until the visitor has interacted with
 * the site, so the click can be silent the very first time.
 */
export default function LoadingScreen() {
  // The applicant island, the member island (/student/dashboard) and the portal's title screen (/student) have their own.
  const recruitment = /^\/student(\/(apply|dashboard\/?$)|\/?$)/.test(usePathname());
  const [phase, setPhase] = useState<"loading" | "click" | "lift" | "gone">("loading");
  const [progress, setProgress] = useState(0.06);
  const [line, setLine] = useState(0);
  const card = useRef<HTMLDivElement>(null);

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

    // Blue characters thrown out of the card, the way a click on the site sprays them.
    const spray = () => {
      const r = card.current?.getBoundingClientRect();
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
        clearInterval(creep);
        setProgress(1);
        setLine(2);
        later(() => {
          setPhase("click");
          audio.play().catch(() => {});
          spray();
          later(() => setPhase("lift"), CLICK_MS);
          later(() => setPhase("gone"), CLICK_MS + LIFT_MS);
        }, FILL_MS);
      }, Math.max(0, MIN_MS - (performance.now() - t0)));
    };

    const update = () => {
      setProgress((q) => Math.max(q, 0.08 + (fonts ? 0.37 : 0) + (loaded ? 0.4 : 0)));
      setLine(loaded ? 2 : fonts ? 1 : 0);
      if (fonts && loaded) finish();
    };
    // Creeps towards 0.92 while it waits, so the line never sits still.
    const creep = window.setInterval(() => setProgress((q) => Math.min(0.92, q + (0.92 - q) * 0.035)), 120);
    const onLoad = () => { loaded = true; update(); };
    window.addEventListener("load", onLoad);
    if (document.fonts) document.fonts.ready.then(() => { fonts = true; update(); }, () => { fonts = true; update(); });
    else fonts = true;
    update();
    later(() => { fonts = true; loaded = true; update(); }, MAX_MS);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(creep);
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
      <div ref={card} className="tl-card">
        <svg className="tl-mark" viewBox="0 0 1410 1352">
          {PEOPLE.map((p, i) => (
            <path key={i} d={p.d} fillRule={p.evenodd ? "evenodd" : undefined} style={{ animationDelay: `${ORDER.indexOf(i) * STEP}ms` }} />
          ))}
        </svg>
        <div className="tl-text"><b>Tethos</b><span>{LINES[line]}</span></div>
        <div className="tl-line"><i style={{ transform: `scaleX(${progress})` }} /></div>
      </div>
    </div>
  );
}

const CSS = `
[data-ts-loader]{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:#0f0f10;transition:transform ${LIFT_MS}ms cubic-bezier(.7,0,.3,1)}
[data-ts-loader][data-phase=lift]{transform:translateY(-100%)}
.tl-card{position:relative;z-index:1;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:12px;width:min(300px,calc(100vw - 32px));padding:16px 18px 18px;box-sizing:border-box;border-radius:16px;background:#17181a;border:1px solid rgba(241,255,255,.08);box-shadow:0 24px 60px rgba(0,0,0,.45);color:#f1ffff;font-family:"Sohne",var(--font-body),system-ui,sans-serif;text-align:left}
[data-phase=click] .tl-card{animation:tl-press .42s cubic-bezier(.34,1.56,.64,1)}
@keyframes tl-press{30%{transform:scale(.94)}}
.tl-mark{width:30px;height:29px;fill:#f1ffff;transition:fill .2s ease}
.tl-mark path{opacity:0;transform-box:fill-box;transform-origin:center;animation:tl-arrive .2s cubic-bezier(.25,1,.5,1) forwards}
@keyframes tl-arrive{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:none}}
[data-phase=loading] .tl-mark{animation:tl-breathe 3.2s ease-in-out .6s infinite}
@keyframes tl-breathe{50%{opacity:.6}}
[data-phase=click] .tl-mark{fill:#1d9bf0}
.tl-text{display:grid;gap:2px;min-width:0}
.tl-text b{font-weight:600;font-size:15px;line-height:1.2}
.tl-text span{min-height:1.4em;color:rgba(241,255,255,.5);font-size:13px;line-height:1.4}
.tl-line{grid-column:1/-1;height:3px;border-radius:2px;overflow:hidden;background:rgba(241,255,255,.1)}
.tl-line i{display:block;height:100%;background:#1d9bf0;transform-origin:left;transition:transform ${FILL_MS}ms cubic-bezier(.2,.9,.3,1)}
.tl-ring{position:absolute;left:50%;top:50%;width:320px;height:320px;margin:-160px 0 0 -160px;border-radius:50%;border:1px solid rgba(29,155,240,.7);opacity:0;pointer-events:none}
[data-phase=click] .tl-ring{animation:tl-ring .8s cubic-bezier(.15,.75,.3,1) forwards}
[data-phase=click] .tl-ring--late{animation-delay:.12s;border-color:rgba(29,155,240,.4)}
@keyframes tl-ring{0%{opacity:.9;transform:scale(.25)}100%{opacity:0;transform:scale(2.6)}}
.tl-burst{position:fixed;z-index:101;pointer-events:none;width:0;height:0;font:600 12px "Sohne Mono",ui-monospace,monospace;color:#1d9bf0}
.tl-burst span{position:absolute;left:-3px;top:-7px;opacity:0;animation:tl-burst var(--t) cubic-bezier(.15,.75,.3,1) var(--d) forwards}
@keyframes tl-burst{0%{transform:translate(0,0) scale(1.2);opacity:1}55%{transform:translate(calc(var(--dx)*.8),calc(var(--dy)*.8 - 4px)) scale(1);opacity:.9}100%{transform:translate(var(--dx),calc(var(--dy) + 14px)) scale(.5);opacity:0}}
`;

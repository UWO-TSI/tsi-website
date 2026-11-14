"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { PEOPLE } from "@/components/site/marks";
import { readyWaits, warmImages } from "@/lib/site/warm";
import { markLowPower } from "@/lib/site/perf";

const SEEN = "tethos-loaded";
// Around the ring from the top, clockwise.
const ORDER = [5, 2, 3, 4, 0, 1];
// A person comes in with each part of the page that finishes loading, at most one every IN_MS, so each one is seen.
const IN_MS = 220;
const TICK_MS = 60;
// The longest the screen waits, however slow the connection.
const MAX_MS = 9000;
const CLICK_MS = 560;
const LIFT_MS = 440;
// The game's UI click (Kenney, CC0), as mp3 so every browser plays it.
const CLICK_SRC = "/audio/sfx/click.mp3";
const SPRAY = "*+#01@%&<>/=:";
const SPRAY_N = 24;

/**
 * The loading screen (David, 2026-11-12: "just the logo, centred, simple", and "it should actually load so each guy
 * turns blue"; 2026-11-14: each person comes in per load step with the pop and the spray), "it needs to load during the loading screen so that everything runs super smooth"): on black, the
 * Tethos mark alone in the middle. Its six people arrive one by one, then each turns blue as the page really loads:
 * the document, the fonts, every image on the page (lazy ones too, decoded), the load event and the globe's first
 * frame, so the sixth lights only when all of it is done (or after MAX_MS). Then the mark clicks: it presses in, plays the game's UI click,
 * sprays characters and sends two rings out, and the black lifts. Once per visit; reduced motion skips it. Browsers
 * may hold back the sound until the visitor has interacted with the site.
 */
export default function LoadingScreen() {
  // The applicant island, the member island (/student/dashboard) and the portal's title screen (/student) have their own.
  const recruitment = /^\/student(\/(apply|dashboard\/?$)|\/?$)/.test(usePathname());
  const [phase, setPhase] = useState<"loading" | "click" | "lift" | "gone">("loading");
  const [shownCount, setShownCount] = useState(0);
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
    const audio = new Audio(CLICK_SRC);
    audio.preload = "auto";
    audio.volume = 0.55;
    let fonts = false, loaded = document.readyState === "complete", done = false;

    // Blue characters thrown out from a point, the way a click on the site sprays them: a few as each person comes in,
    // the full burst out of the whole mark at the click.
    const burstAt = (x: number, y: number, n: number, reach: number, aim?: number) => {
      const burst = document.createElement("div");
      burst.className = "tl-burst";
      burst.style.left = `${x}px`;
      burst.style.top = `${y}px`;
      for (let i = 0; i < n; i++) {
        const s = document.createElement("span");
        // Around a full circle, or fanned out the way the person came from.
        const a = aim === undefined ? (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.5 : aim + (Math.random() - 0.5) * 1.9;
        const d = reach * (0.45 + Math.random() * 0.55);
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
    const spray = () => {
      const r = mark.current?.getBoundingClientRect();
      if (r) burstAt(r.left + r.width / 2, r.top + r.height / 2, SPRAY_N, 200);
    };
    // Where each person sits in the mark (its centre, from the mark's centre, as a fraction of the mark).
    const svg = mark.current!;
    const centres = Array.from(svg.querySelectorAll("path")).map((path) => {
      const b = path.getBBox();
      return { x: (b.x + b.width / 2) / 1410 - 0.5, y: (b.y + b.height / 2) / 1352 - 0.5 };
    });
    centres.forEach((c, i) => {
      const path = svg.querySelectorAll("path")[i] as SVGPathElement;
      // It flies in from a little outside its place.
      path.style.setProperty("--ox", `${(c.x * 46).toFixed(1)}px`);
      path.style.setProperty("--oy", `${(c.y * 46).toFixed(1)}px`);
    });
    const comeIn = (k: number) => {
      const i = ORDER[k], c = centres[i], r = svg.getBoundingClientRect();
      setShownCount(k + 1);
      // The small spray, once it has landed (the pop's peak), fanned out the way it came from.
      later(() => burstAt(r.left + r.width * (0.5 + c.x), r.top + r.height * (0.5 + c.y), 9, 70, Math.atan2(c.y, c.x)), 150);
    };

    const click = () => {
      setPhase("click");
      audio.play().catch(() => {});
      spray();
      later(() => setPhase("lift"), CLICK_MS);
      later(() => setPhase("gone"), CLICK_MS + LIFT_MS);
    };

    // Everything the page will show is fetched and decoded behind the screen (lazy images too), and the heavy pieces
    // (the globe) draw their first frame, so nothing loads or compiles once you start scrolling.
    const warm = warmImages();
    let timedOut = false;
    // How far the page has loaded, 0 to 1; it reaches 1 only when all of that is done (or at the time limit).
    const progress = () => {
      if (timedOut) return 1;
      const images = warm.total ? warm.settled() / warm.total : 1;
      const w = readyWaits(), waits = w.total ? w.ready / w.total : 1;
      if (loaded && fonts && images === 1 && waits === 1) return 1;
      return Math.min(0.95, 0.05 + (document.readyState !== "loading" ? 0.1 : 0) + (fonts ? 0.1 : 0) + (loaded ? 0.1 : 0) + 0.45 * images + 0.2 * waits);
    };
    // Once loaded, a short look at the frame rate: if this machine can't hold it, the visit runs the lighter version.
    const probe = () => new Promise<void>((res) => {
      const times: number[] = [];
      let prev = performance.now();
      const f = (now: number) => {
        times.push(now - prev); prev = now;
        if (times.length < 24) requestAnimationFrame(f);
        else { const s = times.slice(4).sort((a, b) => a - b); if (s[Math.floor(s.length / 2)] > 24) markLowPower(); res(); }
      };
      requestAnimationFrame(f);
    });
    // One more person comes in each time the progress passes another sixth (one every IN_MS at most); the sixth
    // means done, and the mark clicks.
    let shown = 0, lastIn = -1e9;
    const tick = window.setInterval(() => {
      const now = performance.now();
      const target = Math.floor(progress() * ORDER.length + 1e-6);
      if (shown < target && now - lastIn >= IN_MS) { comeIn(shown); shown += 1; lastIn = now; }
      if (shown === ORDER.length && !done) { done = true; clearInterval(tick); later(() => probe().then(() => later(click, 80)), 360); }
    }, TICK_MS);
    const onLoad = () => { loaded = true; };
    window.addEventListener("load", onLoad);
    if (document.fonts) document.fonts.ready.then(() => { fonts = true; }, () => { fonts = true; });
    else fonts = true;
    later(() => { fonts = true; loaded = true; timedOut = true; }, MAX_MS);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(tick);
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
          <path key={i} d={p.d} fillRule={p.evenodd ? "evenodd" : undefined} className={ORDER.indexOf(i) < shownCount ? "is-in" : undefined} />
        ))}
      </svg>
    </div>
  );
}

const CSS = `
[data-ts-loader]{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:#0f0f10;transition:transform ${LIFT_MS}ms cubic-bezier(.7,0,.3,1)}
[data-ts-loader][data-phase=lift]{transform:translateY(-100%)}
.tl-mark{position:relative;z-index:1;width:72px;height:69px;overflow:visible;fill:#f1ffff}
.tl-mark path{transform-box:fill-box;transform-origin:center;opacity:.1;animation:tl-ghost 1.6s ease-in-out infinite}
.tl-mark path.is-in{opacity:1;fill:#1d9bf0;animation:tl-in .5s cubic-bezier(.34,1.56,.64,1) both}
@keyframes tl-ghost{50%{opacity:.18}}
@keyframes tl-in{0%{opacity:0;transform:translate(var(--ox),var(--oy)) scale(.35)}55%{opacity:1;transform:translate(0,0) scale(1.24)}100%{opacity:1;transform:none}}
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

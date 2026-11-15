"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/** What the player says, and from when in the clip (seconds): on the wharf, fishing from the beach, then talking to Bram
 * on the pier, where the camera comes in close and the bubble sits higher, over both of them. The last one is the way in. */
const CUES: { at: number; line: string; high?: boolean; href?: string }[] = [
  { at: 0, line: "This is Tethos Island, our student portal." },
  { at: 2.1, line: "You sign in and walk around as yourself." },
  { at: 4.4, line: "Members at Western and UBC are all here, however far apart." },
  { at: 9, line: "You can find what earlier teams built for their nonprofits." },
  { at: 14.3, line: "Say hi to the residents, and to each other.", high: true },
  { at: 17.3, line: "Find your role →", high: true, href: "/students" },
];
const cueAt = (t: number) => CUES.reduce((k, c, i) => (t >= c.at ? i : k), 0);

/**
 * Tethos Island, the student portal, shown by playing it: a real clip from the game in a big window that pops up as
 * you arrive, scrubbed by the scroll while it's pinned, with the player's speech bubbles saying what the portal is.
 * Narrow screens and reduced motion get the clip playing on its own, the bubbles following it.
 */
export default function IslandScrub() {
  const block = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [cue, setCue] = useState(0);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    const el = block.current!, v = video.current!;
    const pinned = window.matchMedia("(min-width: 821px)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Fetch the whole clip a screen or two before it's needed, so scrubbing never waits on the network.
    const near = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      v.preload = "auto";
      v.load();
      if (!pinned) v.play().catch(() => {});
      near.disconnect();
    }, { rootMargin: "150% 0px" });
    near.observe(el);
    // The window pops up once its stage is well into view.
    const show = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setPop(true); show.disconnect(); } }, { rootMargin: "0px 0px -35% 0px" });
    show.observe(el);
    const follow = () => setCue(cueAt(v.currentTime));
    v.addEventListener("timeupdate", follow);
    if (!pinned) return () => { near.disconnect(); show.disconnect(); v.removeEventListener("timeupdate", follow); };
    let want = 0, raf = 0;
    // Seek at most once a frame, and only when the scroll has moved the time.
    const seek = () => {
      raf = 0;
      if (v.readyState >= 1 && Math.abs(v.currentTime - want) > 0.02) v.currentTime = want;
    };
    const st = ScrollTrigger.create({
      trigger: el, start: "top top", end: "bottom bottom",
      onUpdate: (s) => {
        want = s.progress * (v.duration || 0);
        setCue(cueAt(want));
        if (!raf) raf = requestAnimationFrame(seek);
      },
    });
    // A seek asked for before the clip had loaded is applied once it can be.
    const ready = () => { want = (st.progress || 0) * (v.duration || 0); seek(); };
    v.addEventListener("loadedmetadata", ready);
    return () => {
      near.disconnect(); show.disconnect(); st.kill(); cancelAnimationFrame(raf);
      v.removeEventListener("loadedmetadata", ready); v.removeEventListener("timeupdate", follow);
    };
  }, []);

  const c = CUES[cue];
  return (
    <div ref={block} className="is">
      <h3 className="ts-visually-hidden">A student portal you can walk around in: Tethos Island, our virtual student portal, built as a game.</h3>
      <div className="is__stage">
        <div className="tm-window is__window" data-pop={pop || undefined}>
          <div className="tm-window__bar"><span className="tm-window__dots"><i /><i /><i /></span>play.tethos.ca</div>
          <div className="tm-window__screen">
            <video ref={video} src="/videos/island-clip.mp4" poster="/videos/island-clip.webp" muted playsInline loop preload="none"
              aria-label="Playing Tethos Island: a member walks down the wharf, fishes from the beach and talks to a resident" />
            <div className="is__talk" aria-live="polite">
              {c.href
                ? <Link key={cue} href={c.href} className="is__bubble is__bubble--go" data-high={c.high || undefined}>{c.line}</Link>
                : <p key={cue} className="is__bubble" data-high={c.high || undefined}>{c.line}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

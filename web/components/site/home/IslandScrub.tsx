"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

const POINTS = [
  { title: "Walk in as yourself", line: "Sign in and you're on the island with your own character." },
  { title: "See past projects", line: "Find what earlier teams built for their nonprofits." },
  { title: "Meet the whole club", line: "Hang out with members at Western and UBC, however far apart you are." },
];

/**
 * Tethos Island, the student portal, shown by playing it: a real walk across the island (recorded from the game) that
 * scrubs with the page while the section is pinned, so scrolling moves the player along, and the three things the
 * portal is for light up in turn beside it. Narrow screens and reduced motion get the video playing on its own.
 */
export default function IslandScrub() {
  const block = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [step, setStep] = useState(0);

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
    if (!pinned) {
      // Unpinned: the points still step through as the clip plays.
      const tick = () => setStep(Math.min(POINTS.length - 1, Math.floor((v.currentTime / (v.duration || 1)) * POINTS.length)));
      v.addEventListener("timeupdate", tick);
      return () => { near.disconnect(); v.removeEventListener("timeupdate", tick); };
    }
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
        setStep(Math.min(POINTS.length - 1, Math.floor(s.progress * POINTS.length)));
        if (!raf) raf = requestAnimationFrame(seek);
      },
    });
    // A seek asked for before the clip had loaded is applied once it can be.
    const ready = () => { want = (st.progress || 0) * (v.duration || 0); seek(); };
    v.addEventListener("loadedmetadata", ready);
    return () => { near.disconnect(); st.kill(); cancelAnimationFrame(raf); v.removeEventListener("loadedmetadata", ready); };
  }, []);

  return (
    <div ref={block} className="is">
      <div className="is__stage">
        <div className="is__grid">
          <div className="is__copy">
            <h3 className="ts-h2 is__title">A student portal you can walk around in.</h3>
            <p className="ts-body is__intro">Tethos Island is our virtual student portal, built as a game. Members join from wherever they are.</p>
            <ol className="is__points">
              {POINTS.map((p, i) => (
                <li key={p.title} data-on={i === step || undefined} data-past={i < step || undefined}>
                  <span className="is__num">{String(i + 1).padStart(2, "0")}</span>
                  <span><b>{p.title}</b><span>{p.line}</span></span>
                </li>
              ))}
            </ol>
            <Link href="/students" className="ts-btn ts-btn--primary is__cta">Find your role <span className="ts-btn__arrow">→</span></Link>
          </div>
          <div className="tm-window is__window">
            <div className="tm-window__bar"><span className="tm-window__dots"><i /><i /><i /></span>play.tethos.ca</div>
            <div className="tm-window__screen">
              <video ref={video} src="/videos/island-walk.mp4" poster="/videos/island-walk.webp" muted playsInline loop preload="none"
                aria-label="Playing Tethos Island: a member walks along the wharf, past the tackle shop and down to the beach" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import GlobeVisualizer from "@/components/ui/GlobeVisualizer";
import type { DiveRef } from "@/components/ui/GlobeVisualizerWebGPU";
import { NUMBERS } from "@/lib/site/config";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const range = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

/**
 * The hero and the dive (contentarchitecture.dev's MainHeroStage, rebuilt around our globe):
 * one scroll value p over a 140svh track drives the copy leaving and the globe centring (p .02 to .25),
 * the globe growing and rolling (p .02 to .94, eased ^1.3, done in 3D by the globe), and a light circle
 * opening out of the globe's centre (p .36 to .90, eased ^1.6) with the mission inside, scaling .5 to 1.
 */
export default function HeroDive() {
  const track = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  // Read by the globe every frame; a ref, so scrolling never re-renders React.
  const dive = useRef(0) as DiveRef;
  // The globe's size follows the canvas height, so a tall phone screen needs a smaller resting globe.
  const [base, setBase] = useState(0.72);
  useEffect(() => {
    const fit = () => setBase(window.innerWidth / window.innerHeight < 0.8 ? 0.4 : 0.72);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = stage.current!;
    const apply = (p: number) => {
      const t = range(p, 0.02, 0.25);
      const d = range(p, 0.02, 0.94) ** 1.3;
      const f = range(p, 0.36, 0.9) ** 1.6;
      const radius = (f * Math.hypot(el.clientWidth, el.clientHeight)) / 2;
      dive.current = d;
      el.style.setProperty("--t", t.toFixed(4));
      el.style.setProperty("--r", `${radius.toFixed(1)}px`);
      el.style.setProperty("--arrive", (0.5 + 0.5 * (1 - (1 - f) ** 2)).toFixed(4));
      el.dataset.open = f > 0 ? "true" : "false";
    };
    const st = ScrollTrigger.create({ trigger: track.current, start: "top top", end: "bottom bottom", onUpdate: (self) => apply(self.progress) });
    apply(st.progress);
    return () => st.kill();
  }, [dive]);

  return (
    <section ref={track} className="hd-track" id="hero" aria-label="Tethos">
      <div ref={stage} className="hd-stage" data-tone="dark">
        <div className="hd-globe" aria-hidden="true">
          <GlobeVisualizer className="hd-globe__canvas" dive={dive} base={base} />
        </div>

        <div className="ts-wrap hd-copy">
          <p className="ts-label">Tethos Association</p>
          <h1 className="ts-h1 hd-title">
            <span className="hd-title__dim">Most tech is built to make money.</span>{" "}
            <span>We build it for purpose.</span>
          </h1>
          <p className="ts-lede">Tethos is a student-run nonprofit. We build pro bono technology for nonprofits and the communities they serve.</p>
          <div className="hd-actions">
            <Link href="/npo" className="ts-btn ts-btn--primary">For nonprofits <span className="ts-btn__arrow">→</span></Link>
            <Link href="/genesis" className="ts-btn ts-btn--ghost">For sponsors</Link>
            <Link href="/student/apply" className="ts-btn ts-btn--ghost">For students</Link>
          </div>
        </div>

        <div className="hd-cue" aria-hidden="true">
          <span className="hd-cue__ring" />
          Scroll
        </div>

        <div className="hd-reveal" data-tone="light" id="about">
          <div className="ts-wrap hd-reveal__inner">
            <p className="ts-label">What we do</p>
            <h2 className="ts-h2 hd-mission">We put student teams on real software for nonprofits, at no cost to them.</h2>
            <p className="ts-body hd-mission__body">
              Tethos runs Tech for Social Impact (TSI), our first branch, with chapters at Western and UBC. Each year its teams build for nonprofits and show the work at GENESIS.
            </p>
            <dl className="hd-numbers">
              {NUMBERS.map((n) => (
                <div key={n.label} className="hd-numbers__item">
                  <dt className="ts-label">{n.label}</dt>
                  <dd className="ts-num hd-numbers__value">{n.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

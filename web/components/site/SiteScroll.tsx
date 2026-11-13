"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/** Smooth wheel scrolling kept in step with ScrollTrigger. Off for reduced motion. */
export default function SiteScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 0.9, easing: (t) => 1 - Math.pow(1 - t, 3), smoothWheel: true, touchMultiplier: 1.5 });
    lenis.on("scroll", ScrollTrigger.update);
    // The hero's hold eases back to the globe through it (components/site/home/HeroDive.tsx).
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      delete (window as unknown as { __lenis?: Lenis }).__lenis;
      lenis.destroy();
    };
  }, []);
  return null;
}

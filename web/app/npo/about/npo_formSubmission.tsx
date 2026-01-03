"use client";

import { useEffect, useRef, ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function TimelineWheel() {
  const wrapperRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const track = trackRef.current;
      const wrapper = wrapperRef.current;
      if (!track || !wrapper) return;

      const panels = Array.from(track.children) as HTMLElement[];
      const totalPanels = panels.length;

      // Horizontal scroll driven by vertical scroll
      const scrollTween = gsap.to(track, {
        xPercent: -100 * (totalPanels - 1),
        ease: "none",
        scrollTrigger: {
          trigger: wrapper,
          start: "top top",
          end: () => "+=" + (track.offsetWidth || window.innerWidth),
          scrub: true,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      // Example: simple highlight for the active panel as it comes into view
      panels.forEach((panel, i) => {
        ScrollTrigger.create({
          trigger: panel,
          containerAnimation: scrollTween,
          start: "center center",
          end: "center center",
          onEnter: () => panel.classList.add("ring-4", "ring-blue-500"),
          onLeave: () => panel.classList.remove("ring-4", "ring-blue-500"),
          onEnterBack: () => panel.classList.add("ring-4", "ring-blue-500"),
          onLeaveBack: () => panel.classList.remove("ring-4", "ring-blue-500"),
        });
      });
    }, wrapperRef);

    return () => ctx.revert();
  }, []);

  const pages: ReactNode[] = [
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-white text-4xl font-semibold" style={{ fontFamily: 'Space Grotesk, var(--font-body), system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>Application</h2>
      <p className="text-zinc-300 text-lg max-w-xl text-center" style={{ fontFamily: 'Space Grotesk, var(--font-body), system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
        Submit your organization’s details and project needs.
      </p>
    </div>,
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-white text-4xl font-semibold" style={{ fontFamily: 'Space Grotesk, var(--font-body), system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>Discovery</h2>
      <p className="text-zinc-300 text-lg max-w-xl text-center" style={{ fontFamily: 'Space Grotesk, var(--font-body), system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
        We align on goals, constraints, and success metrics.
      </p>
    </div>,
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-white text-4xl font-semibold" style={{ fontFamily: 'Space Grotesk, var(--font-body), system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>Design</h2>
      <p className="text-zinc-300 text-lg max-w-xl text-center" style={{ fontFamily: 'Space Grotesk, var(--font-body), system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
        Experience and solution design with rapid feedback loops.
      </p>
    </div>,
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-white text-4xl font-semibold" style={{ fontFamily: 'Space Grotesk, var(--font-body), system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>Development</h2>
      <p className="text-zinc-300 text-lg max-w-xl text-center" style={{ fontFamily: 'Space Grotesk, var(--font-body), system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
        Build, test, and launch with ongoing support.
      </p>
    </div>,
  ];

  return (
    <section ref={wrapperRef} className="min-h-screen bg-[#0F0F10] flex items-center justify-center px-0 overflow-hidden">
      <div
        ref={trackRef}
        className="flex w-[400vw] h-screen"
      >
        {pages.map((content, idx) => (
          <div
            key={idx}
            className="min-w-full h-full flex items-center justify-center snap-start"
            style={{ background: idx % 2 === 0 ? "#1A1A1D" : "#0F1F3A" }}
          >
            {content}
          </div>
        ))}
      </div>
    </section>
  );
}


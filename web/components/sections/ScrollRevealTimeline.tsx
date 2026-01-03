"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface ScrollRevealTimelineProps {
  children: React.ReactNode;
  onTimeline: (tl: gsap.core.Timeline) => void;
  start?: string;
  end?: string;
  scrub?: boolean | number;
  pin?: boolean;
}

export default function ScrollRevealTimeline({
  children,
  onTimeline,
  start = "top top",
  end = "+=200%",
  scrub = 1,
  pin = true,
}: ScrollRevealTimelineProps) {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: sectionRef.current,
          start,
          end,
          scrub,
          pin,
          pinSpacing: true,
          anticipatePin: 1,
        },
      });

      onTimeline(tl);
    }, sectionRef);

    return () => ctx.revert();
  }, [onTimeline, start, end, scrub, pin]);

  return (
    <section
      ref={sectionRef}
      className="relative h-screen overflow-hidden bg-[#0F0F10]"
    >
      {children}
    </section>
  );
}
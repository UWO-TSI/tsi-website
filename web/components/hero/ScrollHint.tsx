"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ScrollIndicator from "@/components/ui/ScrollIndicator";

gsap.registerPlugin(ScrollTrigger);

type ScrollHintProps = {
  label: string;
};

export default function ScrollHint({ label }: ScrollHintProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    ScrollTrigger.create({
      trigger: document.body,
      start: "top top",
      end: "top+=120 top", // same fast fade as HomeHero
      scrub: true,
      onUpdate: (self) => {
        gsap.to(ref.current, {
          opacity: 1 - self.progress,
          duration: 0,
          ease: "none",
        });
      },
    });
  }, []);

  return (
    <div
      ref={ref}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-xs font-light text-[#A1A1AA] pointer-events-none"
    >
      <ScrollIndicator />
      <span>{label}</span>
    </div>
  );
}
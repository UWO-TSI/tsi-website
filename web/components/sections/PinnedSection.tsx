"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface PinnedSectionProps {
  children: React.ReactNode;
  start?: string;
  end?: string;
}

export default function PinnedSection({
  children,
  start = "top top",
  end = "+=100%",
}: PinnedSectionProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const st = ScrollTrigger.create({
      trigger: ref.current,
      start,
      end,
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
    });

    return () => st.kill();
  }, [start, end]);

  return (
    <section
      ref={ref}
      className="relative h-screen overflow-hidden bg-[#0F0F10]"
    >
      {children}
    </section>
  );
}
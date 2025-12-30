"use client";

import { ReactNode, useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function PinnedSection({
  id,
  children,
  height = "200%",
}: {
  id: string;
  children: ReactNode;
  height?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: ref.current,
        start: "top top",
        end: `+=${height}`,
        pin: true,
        scrub: 1,
        anticipatePin: 1,
      });
    }, ref);

    return () => ctx.revert();
  }, [height]);

  return (
    <section
      id={id}
      ref={ref}
      className="relative min-h-screen bg-[#0F0F10]"
    >
      {children}
    </section>
  );
}
"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface ScrollFadeProps {
  children: React.ReactNode;
  from?: number;
  to?: number;
}

export default function ScrollFade({
  children,
  from = 0,
  to = 1,
}: ScrollFadeProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.fromTo(
      ref.current,
      { opacity: from },
      {
        opacity: to,
        scrollTrigger: {
          trigger: ref.current,
          start: "top 80%",
          end: "top 50%",
          scrub: true,
        },
      }
    );
  }, [from, to]);

  return <div ref={ref}>{children}</div>;
}
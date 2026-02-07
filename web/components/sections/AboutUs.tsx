"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import AsciiDivider from "@/components/ascii/AsciiDivider";
import {
  EASE_ENTER,
  DURATION_SECTION,
  STAGGER_NORMAL,
} from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function AboutUs() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Simple scroll-triggered fade-up reveal (no pinning)
      const elements = [headingRef.current, bodyRef.current];

      elements.forEach((el, i) => {
        if (!el) return;
        gsap.fromTo(
          el,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: DURATION_SECTION,
            ease: EASE_ENTER,
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              end: "top 50%",
              toggleActions: "play none none none",
            },
            delay: i * STAGGER_NORMAL,
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <>
      <AsciiDivider rows={2} cols={60} />
      <section
        ref={sectionRef}
        className="min-h-[70vh] flex items-center justify-center relative py-32 px-6"
        style={{ background: "var(--color-bg-main)" }}
      >
        <div className="max-w-3xl mx-auto w-full text-center">
          <h2
            ref={headingRef}
            className="font-heading text-3xl md:text-4xl font-semibold mb-8 leading-snug"
            style={{ opacity: 0 }}
          >
            What We Do
          </h2>
          <p
            ref={bodyRef}
            className="text-lg md:text-xl leading-relaxed"
            style={{ color: "var(--color-text-soft)", opacity: 0 }}
          >
            TSI is a high-impact tech collective building real products for
            nonprofits while training the next generation of leaders. Students
            work on real clients and real problems — gaining hands-on experience
            beyond the classroom. We turn ambition into measurable impact and
            experience that actually matters.
          </p>
        </div>
      </section>
    </>
  );
}

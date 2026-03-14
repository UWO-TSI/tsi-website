"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import AsciiDivider from "@/components/ascii/AsciiDivider";
import { EASE_ENTER, DURATION_SECTION } from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function GetStartedSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: DURATION_SECTION,
          ease: EASE_ENTER,
          scrollTrigger: {
            trigger: contentRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <>
      <AsciiDivider rows={2} cols={40} />
      <section
        ref={sectionRef}
        className="py-32 px-6"
        style={{ background: "var(--color-bg-main)" }}
      >
        <div
          ref={contentRef}
          className="max-w-3xl mx-auto text-center"
          style={{ opacity: 0 }}
        >
          <h2 className="font-heading text-4xl md:text-5xl font-semibold mb-6">
            Ready to Build?
          </h2>
          <p
            className="text-lg mb-10 max-w-xl mx-auto"
            style={{ color: "var(--color-text-muted)" }}
          >
            Whether you need a dedicated team for a scoped project or want to
            bring in top student talent for the summer, we&apos;re ready to talk.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="rounded-full bg-[#002FA7] px-8 py-4 text-sm font-medium text-[#F1FFFF] transition-all hover:bg-[#0039CC]">
              Start a Project
            </button>
            <button className="rounded-full border border-zinc-700 px-8 py-4 text-sm font-medium text-zinc-300 transition-all hover:border-zinc-500 hover:text-white">
              Partner for Talent
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

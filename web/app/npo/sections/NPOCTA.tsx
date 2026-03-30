"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import AsciiDivider from "@/components/ascii/AsciiDivider";
import { EASE_ENTER, DURATION_SECTION } from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function NPOCTA() {
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
        className="py-40 px-6"
        style={{ background: "var(--color-bg-main)" }}
      >
        <div
          ref={contentRef}
          className="max-w-3xl mx-auto text-center"
          style={{ opacity: 0 }}
        >
          <p
            className="text-xs tracking-[0.3em] mb-4"
            style={{
              fontFamily: "IBM Plex Mono, monospace",
              color: "var(--color-text-subtle)",
            }}
          >
            Join the Cohort
          </p>
          <h2 className="font-heading text-4xl md:text-5xl font-semibold mb-6">
            Ready to Transform
            <br />
            Your Organization?
          </h2>
          <p
            className="text-lg mb-10 max-w-xl mx-auto"
            style={{ color: "var(--color-text-muted)" }}
          >
            Applications for the 2026 cohort are now open. Join the nonprofits
            already benefiting from modern technology built by driven students.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="rounded-full bg-[#002FA7] px-8 py-4 text-sm font-medium text-[#F1FFFF] transition-all hover:bg-[#0039CC]">
              Apply Now
            </button>
            <button className="rounded-full border border-zinc-700 px-8 py-4 text-sm font-medium text-zinc-300 transition-all hover:border-zinc-500 hover:text-white">
              Attend Genesis
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

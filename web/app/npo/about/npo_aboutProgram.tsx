"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register on client only to avoid SSR issues
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function NPOaboutProgram() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const subheadRef = useRef<HTMLParagraphElement>(null);
  const detailRef = useRef<HTMLParagraphElement>(null);
  const statsContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: contentRef.current,
          start: "top 75%",
          end: "+=60%",
          toggleActions: "play none none reverse",
        },
      });

      const leftLines = statsContainerRef.current
        ? gsap.utils.toArray<HTMLElement>(statsContainerRef.current.querySelectorAll(".stat-line"))
        : [];

      tl.from(headingRef.current, { autoAlpha: 0, y: 30, duration: 0.5, ease: "power2.out" })
        .from(subheadRef.current, { autoAlpha: 0, y: 24, duration: 0.45, ease: "power2.out" }, "<0.1")
        .from(detailRef.current, { autoAlpha: 0, y: 20, duration: 0.4, ease: "power2.out" }, "<0.05")
        .from(leftLines, { autoAlpha: 0, y: 18, duration: 0.35, stagger: 0.1, ease: "power2.out" }, "-0.05")
        .from(imageRef.current, { autoAlpha: 0, y: 20, duration: 0.5, ease: "power2.out" }, "-0.1");
    }, contentRef);

    ScrollTrigger.refresh();

    return () => ctx.revert();
  }, []);



  return (
    <section
      ref={sectionRef}
      className="min-h-screen flex items-center justify-center relative bg-[#0F0F10]"
    >
      <div
        ref={contentRef}
        className="flex flex-col items-center justify-center pl-6 text-center w-full h-full max-w-7xl mx-auto"
      >
        {/* Two-column layout: left 67% (stacked top + bottom split), right 40% (pink image placeholder) */}
        <div className="w-full flex items-start justify-center py-4 gap-6 pl-6 pr-6">
          <div className="flex flex-1 items-stretch gap-4">
            {/* Left column (67%) */}
            <div
              className="flex-[1.2] flex flex-col gap-8"
              style={{
                fontFamily:
                  'Inter, var(--font-body), system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              }}
            >
              {/* Top Paragraph*/}
              <div className="fade-section bg-[#0F0F10] rounded-md pl-6 pt-5 flex items-start justify-start min-h-[22vh]">
                <div className="text-[#F1FFFF] text-left">
                  <h2 ref={headingRef} className="text-6xl mb-4 font-semibold">Our Nonprofit Program</h2>
                  <p ref={subheadRef} className="text-2xl mb-3 text-[#A1A1AA] leading-relaxed">
                    A 8 month pro-bono Initiative supporting nonprofits{" "}
                    <br />
                    with custom technical Solutions
                  </p>
                  <p ref={detailRef} className="text-xl pt-3 pb-3 mb-3 text-[#A1A1AA] leading-relaxed">
                    Designed specifically for registered nonprofit organizations
                  </p>
                </div>
              </div>

              {/* Bottom rectangle: split into two halves */}
              <div className="fade-section bg-[#0F0F10] rounded-md p-6 flex flex-col gap-4">
                <div
                  ref={statsContainerRef}
                  className="flex flex-col gap-3"
                  style={{
                    fontFamily:
                      'var(--font-heading), Space Grotesk, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  }}
                >
                  <div className="stat-line flex items-start justify-start gap-16 px-2">
                    <h3 className="text-white text-2xl font-bold min-w-[140px]">20+</h3>
                    <h3 className="text-white text-xl font-normal">Projects</h3>
                  </div>
                  <div className="stat-line flex items-start justify-start gap-16 px-2">
                    <h3 className="text-white text-2xl font-bold min-w-[140px]">150+</h3>
                    <h3 className="text-white text-xl font-normal">Alum & members</h3>
                  </div>
                  <div className="stat-line flex items-start justify-start gap-16 px-2">
                    <h3 className="text-white text-2xl font-bold min-w-[140px]">1500+</h3>
                    <h3 className="text-white text-xl font-normal">Community</h3>
                  </div>
                  <div className="stat-line flex items-start justify-start gap-16 px-2">
                    <h3 className="text-white text-2xl font-bold min-w-[140px]">$200,000+</h3>
                    <h3 className="text-white text-xl font-normal">In value saved for NPO</h3>
                  </div>
                </div>
              </div>
            </div>

            {/* Right column (33%) - pink image placeholder */}
            <div className="fade-section flex-[0.8] flex items-center justify-center pr-4 pl-2">
              <div
                ref={imageRef}
                className="w-full h-full bg-[#FF4DA6] rounded-md flex items-center justify-center p-4"
                style={{
                  minHeight: "60vh",
                  boxShadow: "0 6px 18px rgba(255,77,166,0.08)",
                }}
              >
                <span className="text-white font-medium text-base">
                  Image placeholder
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function NPOaboutProgram() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Start with content invisible
      gsap.set(contentRef.current, {
        opacity: 0,
      });

      // Fade in content as section enters viewport
      gsap.to(contentRef.current, {
        opacity: 1,
        duration: 1,
        ease: "power2.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%", // Start fade when section is 80% down viewport
          end: "top 30%",   // Finish fade when section is 30% down viewport
          scrub: true,
          toggleActions: "play none none reverse",
        },
      });
    }, sectionRef);

    // Refresh ScrollTrigger after assets load
    const refreshTimer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 100);

    const handleLoad = () => {
      ScrollTrigger.refresh();
    };

    window.addEventListener("load", handleLoad);

    return () => {
      ctx.revert();
      clearTimeout(refreshTimer);
      window.removeEventListener("load", handleLoad);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="min-h-screen flex items-center justify-center relative bg-[#0F0F10]"
    >
      <div
        ref={contentRef}
        className="flex flex-col items-center justify-center px-6 text-center w-full h-full"
      >
        {/* Two-column layout: left 67% (stacked top + bottom split), right 40% (pink image placeholder) */}
        <div className="w-full flex items-start justify-center py-2">
          <div className="w-[95%] max-w-[100vw] flex items-stretch">
            {/* Left column (67%) */}
            <div
              className="w-[67%] flex flex-col gap-6"
              style={{
                fontFamily:
                  'Inter, var(--font-body), system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              }}
            >
              {/* Top Paragraph*/}
              <div className="bg-[#0F0F10] rounded-md pl-6 pt-4 flex items-start justify-start min-h-[24vh]">
                <div className="text-[#F1FFFF] text-left">
                  <h2 className="text-6xl mb-4">Our Nonprofit Program</h2>
                  <p className="text-2xl mb-4 text-[#A1A1AA] leading-relaxed">
                    A 8 month pro-bono Initiative supporting nonprofits{" "}
                    <br />
                    with custom technical Solutions
                  </p>
                  <p className="text-2xl pt-4 pb-4 mb-4 text-[#A1A1AA] leading-relaxed">
                    Designed specifically for registered nonprofit organizations
                  </p>
                </div>
              </div>

              {/* Bottom rectangle: split into two halves */}
              <div className="bg-[#0F0F10] rounded-md p-4 flex gap-4">
                <div
                  className="flex-1 p-4 bg-transparent flex flex-col justify-center items-start"
                  style={{
                    fontFamily:
                      'var(--font-heading), Space Grotesk, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  }}
                >
                  <h3 className="text-white text-2xl font-bold mb-2">20+</h3>
                  <h3 className="text-white text-2xl font-bold mb-2">150+</h3>
                  <h3 className="text-white text-2xl font-bold mb-2">1500+</h3>
                  <h3 className="text-white text-2xl font-bold mb-2">
                    $200,000+
                  </h3>
                </div>
                <div
                  className="flex-1 p-4 bg-transparent flex flex-col justify-center items-start"
                  style={{
                    fontFamily:
                      'var(--font-heading), Space Grotesk, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  }}
                >
                  <h3 className="text-white text-2xl font-medium mb-2">
                    Projects
                  </h3>
                  <h3 className="text-white text-2xl font-medium mb-2">
                    Alum & members
                  </h3>
                  <h3 className="text-white text-2xl font-medium mb-2">
                    Community
                  </h3>
                  <h3 className="text-white text-2xl font-medium mb-2">
                    In value saved for NPO
                  </h3>
                </div>
              </div>
            </div>

            {/* Right column (33%) - pink image placeholder */}
            <div className="w-[40%] flex items-center justify-center">
              <div
                className="w-full h-full bg-[#FF4DA6] rounded-md flex items-center justify-center p-6"
                style={{
                  minHeight: "76vh",
                  boxShadow: "0 6px 18px rgba(255,77,166,0.08)",
                }}
              >
                <span className="text-white font-medium">
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

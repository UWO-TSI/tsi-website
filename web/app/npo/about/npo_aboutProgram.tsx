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



  return (
    <section
      ref={sectionRef}
      className="min-h-screen flex items-center justify-center relative bg-[#0F0F10]"
    >
      <div
        ref={contentRef}
        className="flex flex-col items-center justify-center pl-15 text-center w-full h-full"
      >
        {/* Two-column layout: left 67% (stacked top + bottom split), right 40% (pink image placeholder) */}
        <div className="w-full flex items-start justify-center py-2 gap-6 pl-15 pr-15">
          <div className="flex-1 flex items-stretch">
            {/* Left column (67%) */}
            <div
              className="flex-1 flex flex-col gap-6"
              style={{
                fontFamily:
                  'Inter, var(--font-body), system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              }}
            >
              {/* Top Paragraph*/}
              <div className="bg-[#0F0F10] rounded-md pl-6 pt-4 flex items-start justify-start min-h-[24vh]">
                <div className="text-[#F1FFFF] text-left">
                  <h2 className="text-7xl mb-4 font-semibold">Our Nonprofit Program</h2>
                  <p className="text-3xl mb-4 text-[#A1A1AA] leading-relaxed">
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
              <div className="bg-[#0F0F10] rounded-md p-6 flex gap-4">
                <div
                  className="flex-1 p-4 bg-transparent flex flex-col justify-center items-start"
                  style={{
                    fontFamily:
                      'var(--font-heading), Space Grotesk, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  }}
                >
                  <h3 className="text-white text-3xl font-bold mb-2 p-4">20+</h3>
                  <h3 className="text-white text-3xl font-bold mb-2 p-4">150+</h3>
                  <h3 className="text-white text-3xl font-bold mb-2 p-4">1500+</h3>
                <h3 className="text-white text-3xl font-bold  mb-2 p-4">
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
                  <h3 className="text-white text-3xl font-normal mb-2 p-4">
                    Projects
                  </h3>
                  <h3 className="text-white text-3xl font-normal mb-2 p-4">
                    Alum & members
                  </h3>
                  <h3 className="text-white text-3xl font-normal mb-2 p-4">
                    Community
                  </h3>
                  <h3 className="text-white text-3xl font-normal mb-2 p-4">
                    In value saved for NPO
                  </h3>
                </div>
              </div>
            </div>

            {/* Right column (33%) - pink image placeholder */}
            <div className="flex-1 flex items-center justify-center pr-15 pl-10">
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

"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import ScrollIndicator from "@/components/ui/ScrollIndicator";
import Button from "@/components/ui/Button";
import ButtonHelperText from "@/components/ui/ButtonHelperText";

export default function CompaniesHero() {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;

    gsap.fromTo(
      contentRef.current,
      { opacity: 0, y: 16 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        delay: 0.1,
      }
    );
  }, []);

  return (
    <section className="relative bg-[#0F0F10] h-[calc(100vh-96px)] flex flex-col justify-center items-center overflow-hidden">
      {/* Main hero content */}
      <div
        ref={contentRef}
        className="
          flex
          flex-col
          items-center
          text-center
          px-6
          w-full
          max-w-5xl
        "
      >
        <h1 className="font-heading text-5xl md:text-6xl font-semibold leading-tight tracking-tight mb-14">
          Technology & Talent
          <br />
          For Ambitious Companies.
        </h1>

        <div className="flex flex-col sm:flex-row items-start justify-center gap-14">
          <div className="flex flex-col items-center w-[260px]">
            <Button>Start a Project</Button>
            <div className="mt-3 min-h-[40px]">
              <ButtonHelperText>
                Custom software, AI, and design services
              </ButtonHelperText>
            </div>
          </div>

          <div className="flex flex-col items-center w-[260px]">
            <Button variant="secondary">Partner for Talent</Button>
            <div className="mt-3 min-h-[40px]">
              <ButtonHelperText>
                Access top student developers through our guided summer program
              </ButtonHelperText>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[14px] font-light text-[#A1A1AA] pointer-events-none">
        <ScrollIndicator />
        <span>Scroll for more info</span>
      </div>
    </section>
  );
}
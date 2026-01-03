"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ScrollIndicator from "@/components/ui/ScrollIndicator";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function HomeHero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Set initial opacity to 1 (no fade-in on load)
      gsap.set(contentRef.current, {
        opacity: 1,
      });

      // Fade out scroll indicator and text quickly when scrolling starts
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "top+=500 top", // Quick fade within first 100px of scroll
        scrub: true,
        onUpdate: (self) => {
          const progress = self.progress;
          // Quick fade out - fully faded by 100px of scroll
          const opacity = Math.max(0, 1 - progress);
          gsap.to(scrollIndicatorRef.current, {
            opacity: opacity,
            duration: 0,
            ease: "none",
          });
        },
      });

      // Pin section and fade out gradually over scroll distance
      const st = ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "+=262.5%", // Pin for ~2.6 viewport heights (25% shorter than 350%)
        scrub: true, // Changed to true for immediate, linear response
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          // Linear fade from start to end (opacity 1 → 0)
          const progress = self.progress;
          console.log("Scroll progress:", progress); // Debug log
          gsap.to(contentRef.current, {
            opacity: 1 - progress,
            duration: 0,
            ease: "none", // Linear easing
          });
        },
      });

      // Debug: log the ScrollTrigger details
      console.log("ScrollTrigger created:", {
        start: st.start,
        end: st.end,
        pin: st.pin
      });

    }, sectionRef);

    // Refresh ScrollTrigger after fonts/images load
    const refreshTimer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 100);

    const handleLoad = () => {
      ScrollTrigger.refresh();
    };
    
    window.addEventListener('load', handleLoad);

    return () => {
      ctx.revert();
      clearTimeout(refreshTimer);
      window.removeEventListener('load', handleLoad);
    };
  }, []);

  return (
    <>
      <section
        ref={sectionRef}
        className="h-screen flex items-center justify-center relative bg-[#0F0F10] overflow-hidden"
      >
        <div
          ref={contentRef}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center px-6 text-center w-full max-w-5xl"
        >
          <h1 className="font-heading mb-8 text-6xl font-semibold leading-tight tracking-tight">
            Technology That Moves People Forwards.
          </h1>
          
          <p className="max-w-2xl text-lg text-zinc-400 mb-12">
            We build modern software for nonprofits, companies, and communities.
            <br />
            Powered by student developers. Designed for real-world impact.
          </p>
        </div>
        
        {/* Scroll indicator and text - positioned at bottom */}
        <div 
          ref={scrollIndicatorRef}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <ScrollIndicator />
          <span className="text-xs font-light leading-[1.5] text-[#A1A1AA]">
            Discover who we serve
          </span>
        </div>
      </section>
    </>
  );
}
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

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Initial entrance animation
      gsap.from(contentRef.current, {
        opacity: 0,
        duration: 1.2,
        ease: "power3.out",
        delay: 0.3,
      });

      // Pin section and fade out gradually over scroll distance
      const st = ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "+=350%", // Pin for 3 viewport heights of scrolling (2x of 150%)
        scrub: true, // Changed to true for immediate, linear response
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        markers: true, // Turn off when working
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
          className="flex flex-col items-center justify-center px-6 text-center w-full max-w-5xl"
        >
          <h1 className="font-heading mb-8 text-6xl font-semibold leading-tight tracking-tight">
            Technology That Moves People Forwards.
          </h1>
          
          <p className="max-w-2xl text-lg text-zinc-400 mb-12">
            We build modern software for nonprofits, companies, and communities.
            <br />
            Powered by student developers. Designed for real-world impact.
          </p>
          
          {/* Video play button with text */}
          <div className="flex flex-col items-center gap-3 mb-16">
            <button className="w-[43px] h-[43px] rounded-full bg-zinc-400/30 hover:bg-zinc-400/40 transition-colors flex items-center justify-center group">
              <svg
                className="w-4 h-4 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
                style={{ marginLeft: '2px' }}
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
            <a
              href="#"
              className="text-sm text-white hover:text-zinc-300 transition-colors"
            >
              Watch Our Story →
            </a>
          </div>
          
          {/* Scroll indicator and text */}
          <div className="flex flex-col items-center gap-2">
            <ScrollIndicator />
            <span className="text-xs font-light leading-[1.5] text-[#A1A1AA]">
              Discover who we serve
            </span>
          </div>
        </div>
      </section>

      {/* Add a placeholder section to test the pin */}
      <section className="min-h-screen bg-white flex items-center justify-center">
        <h2 className="text-4xl text-black">Next Section</h2>
      </section>
    </>
  );
}
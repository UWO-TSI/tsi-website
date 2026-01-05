"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function AboutUs() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Set initial state - content starts invisible
      gsap.set(contentRef.current, {
        opacity: 0,
      });

      // Simple fade-in as section comes into view
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top center",
        end: "top top",
        scrub: true,
        onUpdate: (self) => {
          gsap.set(contentRef.current, {
            opacity: self.progress,
          });
        },
      });

      // Pin section when top matches viewport top
      // This will activate after HomeHero's pin ends
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "+=200%", // Pin for 200% viewport height (2 viewport heights)
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
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
    <section
      ref={sectionRef}
      className="h-screen flex items-center justify-center relative bg-white py-24 px-6"
    >
      <div className="max-w-4xl mx-auto w-full">
        <div ref={contentRef}>
          <p className="text-xl text-zinc-700 leading-relaxed mb-6 text-center">
            TSI is a high-impact tech collective building real products for nonprofits 
            while training the next generation of leaders.
            Students work on real clients and real problems, gaining hands-on experience beyond the classroom.
            We turn ambition into measurable impact and experience that actually matters.
          </p>
        </div>
      </div>
    </section>
  );
}


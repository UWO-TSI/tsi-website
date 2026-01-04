"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

const steps = [
  { id: "01", title: "Application" },
  { id: "02", title: "Discovery" },
  { id: "03", title: "Design" },
  { id: "04", title: "Development" },
];

export default function CompaniesBuildTimeline() {
  const sectionRef = useRef<HTMLElement>(null);
  const labelRef = useRef<HTMLParagraphElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const stepRefs = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    
    if (!labelRef.current || !descRef.current || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      // Pin the section and animate it as next section overlaps
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "bottom top",
        pin: true,
        pinSpacing: false,
      });

      // Blur/scale animation as you scroll
      gsap.to(sectionRef.current, {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
        scale: 0.9,
        borderRadius: 40,
        ease: "none",
      });

      // Content fade-in timeline
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top bottom",
          end: "+=60%",
          scrub: 1,
        },
      });

      tl.fromTo(
        labelRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.3 }
      );

      stepRefs.current.forEach((el, i) => {
        tl.fromTo(
          el,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.25 },
          ">-0.05"
        );
      });

      tl.fromTo(
        descRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.3 },
        ">-0.1"
      );
    });

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="sticky top-0 h-screen bg-[#0F0F10] flex items-center overflow-hidden" style={{ zIndex: 10 }}>
      <div className="max-w-6xl mx-auto w-full px-8 grid grid-cols-2 gap-24">

        {/* LEFT */}
        <div className="space-y-8">
          <p
            ref={labelRef}
            className="text-sm uppercase tracking-widest text-zinc-500 opacity-0"
          >
            Timeline
          </p>

          {steps.map((step, i) => (
            <div
              key={step.id}
              ref={(el) => {
                if (el) stepRefs.current[i] = el;
              }}
              className="text-4xl font-heading font-semibold text-zinc-500 opacity-0"
            >
              <span className="mr-4 text-zinc-400">{step.id}</span>
              {step.title}
            </div>
          ))}
        </div>

        {/* RIGHT */}
        <div className="flex items-center text-lg text-zinc-500 leading-relaxed">
          <p ref={descRef} className="opacity-0">
            Scroll to progress through each stage of our process.
            Each phase builds clarity, momentum, and confidence.
          </p>
        </div>

      </div>
    </section>
  );
}
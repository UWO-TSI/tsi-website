"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import DecryptedText from "@/components/ui/DecryptedText";
import ShinyText from "@/components/ui/ShinyText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const DELIVERABLES = [
  { marker: "→", title: "Production-Ready Software", desc: "Deployed, tested, and ready for your users." },
  { marker: "//", title: "Source Code & Documentation", desc: "Full codebase with technical docs and README." },
  { marker: "⌘", title: "Design Assets", desc: "Figma files, style guide, and component library." },
  { marker: "▸", title: "Training & Onboarding", desc: "Hands-on sessions for your staff to own the product." },
  { marker: "◆", title: "30-Day Support Window", desc: "Bug fixes and questions answered after handoff." },
  { marker: "■", title: "Impact Report", desc: "Metrics and outcomes for your board and stakeholders." },
];

const FAQ = [
  {
    q: "Do we own the code?",
    a: "Yes. 100% ownership transfers to your organization at handoff. No licensing fees, no strings attached.",
  },
  {
    q: "What's the time commitment from our side?",
    a: "About 2-3 hours per week for check-ins and feedback. We need one point of contact from your team available for questions.",
  },
  {
    q: "Who's eligible?",
    a: "Any registered nonprofit, charity, or social enterprise. We prioritize organizations with a clear technology need and limited budget for custom software.",
  },
  {
    q: "What tech stacks do you use?",
    a: "We match the stack to the project. Most commonly: Next.js, React, Node.js, PostgreSQL, Supabase. We'll discuss during Discovery.",
  },
  {
    q: "Is there really no cost?",
    a: "Correct. The program is fully pro bono. Our students gain experience, your org gets production software. Sponsors fund our operations.",
  },
  {
    q: "What happens after the 30-day support window?",
    a: "You're on your own, but you have full source code and documentation. Many orgs maintain the software with internal staff or re-apply for a follow-up cohort.",
  },
];

function FAQItem({ item, index }: { item: typeof FAQ[0]; index: number }) {
  const [open, setOpen] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!answerRef.current || !contentRef.current) return;
    const height = open ? contentRef.current.scrollHeight : 0;
    gsap.to(answerRef.current, {
      height,
      duration: 0.4,
      ease: "power3.inOut",
    });
  }, [open]);

  return (
    <div
      className="border-b transition-colors duration-300"
      style={{ borderColor: open ? "rgba(29,155,240,0.15)" : "rgba(255,255,255,0.06)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left cursor-pointer group"
      >
        <span className="flex items-start gap-3 pr-8">
          <span
            className="text-xs mt-0.5 flex-shrink-0"
            style={{ color: "rgba(29,155,240,0.5)", fontFamily: "var(--font-highlight)" }}
          >
            Q.{String(index + 1).padStart(2, "0")}
          </span>
          <span
            className="text-sm md:text-base font-medium transition-colors duration-300"
            style={{ color: open ? "#F1FFFF" : "rgba(255,255,255,0.6)" }}
          >
            {item.q}
          </span>
        </span>
        <span
          className="flex-shrink-0 text-lg transition-transform duration-300"
          style={{
            color: "rgba(29,155,240,0.6)",
            transform: open ? "rotate(45deg)" : "rotate(0deg)",
            fontFamily: "var(--font-highlight)",
          }}
        >
          +
        </span>
      </button>
      <div ref={answerRef} className="overflow-hidden" style={{ height: 0 }}>
        <div ref={contentRef} className="pb-5">
          <p
            className="text-sm leading-relaxed"
            style={{ color: "rgba(255,255,255,0.4)", maxWidth: "500px" }}
          >
            {item.a}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function NPODetailsSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set([leftRef.current, rightRef.current], { opacity: 1 });
        return;
      }

      // Left col: slide from left
      gsap.fromTo(
        leftRef.current,
        { opacity: 0, x: -40 },
        {
          opacity: 1,
          x: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 65%", once: true },
        }
      );

      // Right col: slide from right
      gsap.fromTo(
        rightRef.current,
        { opacity: 0, x: 40 },
        {
          opacity: 1,
          x: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 65%", once: true },
          delay: 0.15,
        }
      );

      // Deliverable items stagger
      const items = leftRef.current?.querySelectorAll(".deliverable-item");
      if (items) {
        gsap.fromTo(
          Array.from(items),
          { opacity: 0, x: -20 },
          {
            opacity: 1,
            x: 0,
            duration: 0.5,
            ease: "power3.out",
            stagger: 0.08,
            scrollTrigger: { trigger: leftRef.current, start: "top 70%", once: true },
            delay: 0.3,
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="npo-details"
      ref={sectionRef}
      data-navbar-theme="dark"
      className="relative py-32 md:py-44 px-8 md:px-20 lg:px-28 overflow-hidden"
      style={{ background: "#0F0F10" }}
    >
      {/* Gradient blend */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{ height: "200px", background: "linear-gradient(to bottom, #0a0a0b, #0F0F10)" }}
      />

      {/* Ambient glow */}
      <div
        className="absolute top-1/2 right-0 -translate-y-1/2 pointer-events-none"
        style={{
          width: "600px",
          height: "600px",
          background: "radial-gradient(circle, rgba(29,155,240,0.10) 0%, transparent 70%)",
          filter: "blur(100px)",
          transform: "translateX(30%)",
        }}
      />

      <div className="relative max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-16 lg:gap-24">
        {/* Left: What you get */}
        <div ref={leftRef} className="lg:w-[45%] flex-shrink-0" style={{ opacity: 0 }}>
          <p
            className="text-xs tracking-widest uppercase mb-4"
            style={{ color: "#1d9bf0", fontFamily: "var(--font-highlight)" }}
          >
            <DecryptedText text="What you receive" speed={40} maxIterations={12} sequential characters="01!@#$%_-+=<>" className="text-[#1d9bf0]" encryptedClassName="text-[rgba(29,155,240,0.3)]" animateOn="view" />
          </p>
          <h2
            className="tracking-tight mb-10"
            style={{
              fontFamily: '"Test Sohne", sans-serif',
              fontSize: "clamp(24px, 3.5vw, 40px)",
              fontWeight: 500,
              color: "#F1FFFF",
              lineHeight: 1.15,
            }}
          >
            Everything you need to <ShinyText text="launch." color="rgba(255,255,255,0.6)" shineColor="#F1FFFF" speed={4} />
          </h2>

          <div className="flex flex-col gap-1">
            {DELIVERABLES.map((item, i) => (
              <div
                key={item.title}
                className="deliverable-item flex items-start gap-4 py-5 border-b"
                style={{ borderColor: "rgba(255,255,255,0.06)", opacity: 0 }}
              >
                <span
                  className="text-sm mt-0.5 flex-shrink-0"
                  style={{ color: "rgba(29,155,240,0.6)", fontFamily: "var(--font-highlight)" }}
                >
                  {item.marker}
                </span>
                <div>
                  <p className="text-base font-medium mb-1" style={{ color: "#F1FFFF" }}>
                    {item.title}
                  </p>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: FAQ */}
        <div ref={rightRef} className="lg:flex-1" style={{ opacity: 0 }}>
          <p
            className="text-xs tracking-widest uppercase mb-4"
            style={{ color: "#1d9bf0", fontFamily: "var(--font-highlight)" }}
          >
            <DecryptedText text="Common questions" speed={40} maxIterations={12} sequential characters="01!@#$%_-+=<>" className="text-[#1d9bf0]" encryptedClassName="text-[rgba(29,155,240,0.3)]" animateOn="view" />
          </p>
          <h2
            className="tracking-tight mb-10"
            style={{
              fontFamily: '"Test Sohne", sans-serif',
              fontSize: "clamp(24px, 3.5vw, 40px)",
              fontWeight: 500,
              color: "#F1FFFF",
              lineHeight: 1.15,
            }}
          >
            Frequently asked.
          </h2>

          <div>
            {FAQ.map((item, i) => (
              <FAQItem key={i} item={item} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

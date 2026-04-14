"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const FAQ = [
  {
    q: "What tech stacks do you work with?",
    a: "We match the stack to the project. Most commonly: Next.js, React, React Native, Node.js, Python, PostgreSQL, Supabase, AWS. We discuss during the scoping call.",
  },
  {
    q: "What's the typical timeline?",
    a: "Starter projects: 4-6 weeks. Growth projects: 8-12 weeks. Enterprise: scoped together. Timelines include design, development, testing, and handoff.",
  },
  {
    q: "Who owns the IP?",
    a: "You do. 100% of source code, design assets, and documentation transfer to your organization at project completion.",
  },
  {
    q: "How is this different from hiring a dev agency?",
    a: "Our teams are student developers mentored by industry professionals. You get production-quality work at a fraction of agency rates, while giving students real-world experience.",
  },
  {
    q: "Can we hire the students after the project?",
    a: "Yes. Many of our company partners convert project team members into full-time hires. Our Talent Pipeline track is specifically designed for this.",
  },
  {
    q: "What if the project scope changes mid-build?",
    a: "We build in a scope review at the halfway point. Minor adjustments are expected. Major scope changes are re-quoted transparently.",
  },
];

function FAQItem({ item, index }: { item: typeof FAQ[0]; index: number }) {
  const [open, setOpen] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!answerRef.current || !contentRef.current) return;
    gsap.to(answerRef.current, {
      height: open ? contentRef.current.scrollHeight : 0,
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
        className="w-full flex items-center justify-between py-6 text-left cursor-pointer"
      >
        <span className="flex items-start gap-4 pr-8">
          <span
            className="text-xs mt-0.5 flex-shrink-0"
            style={{ color: "rgba(29,155,240,0.5)", fontFamily: "var(--font-highlight)" }}
          >
            {String(index + 1).padStart(2, "0")}
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
        <div ref={contentRef} className="pb-6 pl-10">
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)", maxWidth: "560px" }}>
            {item.a}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CompanyFAQ() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set(headerRef.current, { opacity: 1 });
        return;
      }

      gsap.fromTo(
        headerRef.current,
        { opacity: 0, y: 30 },
        {
          opacity: 1, y: 0, duration: 0.8, ease: "power3.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 70%", once: true },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="company-faq"
      ref={sectionRef}
      data-navbar-theme="dark"
      className="relative py-32 md:py-44 px-8 md:px-20 lg:px-28"
      style={{ background: "#0F0F10" }}
    >
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{ height: "200px", background: "linear-gradient(to bottom, #0a0a0b, #0F0F10)" }}
      />

      <div className="relative max-w-[700px] mx-auto">
        <div ref={headerRef} className="text-center mb-14" style={{ opacity: 0 }}>
          <p
            className="text-xs tracking-widest uppercase mb-4"
            style={{ color: "rgba(29,155,240,0.6)", fontFamily: "var(--font-highlight)" }}
          >
            <span style={{ color: "#1d9bf0" }}>$</span> help --faq
          </p>
          <h2
            className="tracking-tight"
            style={{
              fontFamily: '"Test Sohne", sans-serif',
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 500,
              color: "#F1FFFF",
              lineHeight: 1.1,
            }}
          >
            Common questions.
          </h2>
        </div>

        <div>
          {FAQ.map((item, i) => (
            <FAQItem key={i} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { EASE_ENTER, DURATION_SECTION, STAGGER_NORMAL } from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const faqs = [
  {
    q: "How much does a project cost?",
    a: "Our nonprofit projects are fully pro bono. For corporate partnerships and custom engagements, pricing depends on scope, timeline, and complexity. Reach out to discuss your specific needs.",
  },
  {
    q: "What's the typical project timeline?",
    a: "Our standard delivery cycle is 8 months from discovery to handoff. This includes 2 weeks of application review, 3 weeks of discovery, 4 weeks of design, 16 weeks of development, and 3 weeks of handoff and training.",
  },
  {
    q: "Who works on my project?",
    a: "Each project is led by a Project Manager and staffed with 4-6 student developers. All team members are vetted through our recruitment process and bring real technical skills in modern frameworks like React, Next.js, and Python.",
  },
  {
    q: "What technologies do you use?",
    a: "We build with production-grade tools: Next.js, React, TypeScript, Node.js, PostgreSQL, Supabase, AWS, and more. Our tech choices are driven by what's best for your project, not what's trendy.",
  },
  {
    q: "Do you provide ongoing support?",
    a: "Every project includes a 30-day post-handoff support window. We also provide full source code, documentation, and staff training to ensure your team can maintain the software independently.",
  },
  {
    q: "How do I hire your graduates?",
    a: "Our Summer Internship Pipeline (SIP) places top-performing students directly into partner companies. Contact us about sponsoring internship positions or accessing our talent pool.",
  },
  {
    q: "What kind of organizations do you work with?",
    a: "We primarily serve registered nonprofits through our pro bono program. We also partner with companies for sponsored projects, talent placement, and corporate social responsibility initiatives.",
  },
];

function FAQItem({
  faq,
  isOpen,
  onToggle,
}: {
  faq: { q: string; a: string };
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="border-b transition-colors"
      style={{ borderColor: "rgba(255,255,255,0.06)" }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-6 text-left group"
      >
        <span
          className={`font-heading text-base md:text-lg font-medium transition-colors ${
            isOpen ? "text-[#F1FFFF]" : "text-[#9CA3AF] group-hover:text-[#F1FFFF]"
          }`}
        >
          {faq.q}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="flex-shrink-0 ml-4"
        >
          <ChevronDown
            className="w-5 h-5"
            style={{ color: isOpen ? "#002FA7" : "#6B7280" }}
          />
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="text-sm text-[#9CA3AF] leading-relaxed pb-6 max-w-2xl">
              {faq.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        headerRef.current,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: DURATION_SECTION,
          ease: EASE_ENTER,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        }
      );

      gsap.fromTo(
        listRef.current,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: DURATION_SECTION,
          ease: EASE_ENTER,
          delay: STAGGER_NORMAL,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      data-navbar-theme="dark"
      className="py-32 px-6 md:px-16"
      style={{ background: "#0F0F10" }}
    >
      <div className="max-w-3xl mx-auto">
        <div ref={headerRef} className="mb-12" style={{ opacity: 0 }}>
          <p
            className="text-xs tracking-[0.3em] uppercase mb-4"
            style={{
              fontFamily: "IBM Plex Mono, monospace",
              color: "#6B7280",
            }}
          >
            FAQ
          </p>
          <h2 className="font-heading text-3xl md:text-4xl font-semibold text-[#F1FFFF]">
            Common Questions
          </h2>
        </div>

        <div ref={listRef} style={{ opacity: 0 }}>
          {faqs.map((faq, i) => (
            <FAQItem
              key={i}
              faq={faq}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

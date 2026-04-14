"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SpotlightCard from "@/components/ui/SpotlightCard";
import DecryptedText from "@/components/ui/DecryptedText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface Tier {
  name: string;
  price: string;
  priceNum?: number; // for count-up animation
  description: string;
  features: string[];
  highlighted?: boolean;
}

const PROJECT_TIERS: Tier[] = [
  {
    name: "Starter",
    price: "$5K",
    priceNum: 5,
    description: "Landing page, internal tool, or MVP prototype. 4-6 week delivery.",
    features: ["1 developer + 1 designer", "Bi-weekly demos", "Source code ownership", "30-day support"],
  },
  {
    name: "Growth",
    price: "$12K",
    priceNum: 12,
    description: "Full-stack web app, API integration, or data pipeline. 8-12 weeks.",
    features: ["2-3 developers + 1 designer", "Weekly standups", "CI/CD + testing", "60-day support", "Design system included"],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "Multi-platform, complex integrations, or ongoing retainer. Scoped together.",
    features: ["Dedicated team (4-6)", "Embedded PM", "SLA + priority support", "Quarterly reviews", "Custom contracts"],
  },
];

const TALENT_DETAILS = [
  { label: "Duration", value: "4-16 months", desc: "Summer terms, co-op, or part-time contracts" },
  { label: "Roles", value: "Dev, Design, PM", desc: "Full-stack, frontend, mobile, UX/UI, project management" },
  { label: "Vetting", value: "Pre-screened", desc: "Portfolio review, technical assessment, culture fit interview" },
  { label: "Support", value: "Guided", desc: "Tethos mentors and weekly check-ins throughout placement" },
];

export default function CompanyTracks() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);
  const talentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set([projectRef.current, talentRef.current], { opacity: 1 });
        return;
      }

      // Project cards scale in
      const cards = projectRef.current?.querySelectorAll(".tier-card");
      if (cards) {
        gsap.fromTo(
          Array.from(cards),
          { opacity: 0, y: 40, scale: 0.95 },
          {
            opacity: 1, y: 0, scale: 1,
            duration: 0.7, ease: "power3.out",
            stagger: 0.12,
            scrollTrigger: { trigger: projectRef.current, start: "top 70%", once: true },
          }
        );
      }

      // Price count-up animation
      const priceEls = projectRef.current?.querySelectorAll(".price-value");
      priceEls?.forEach((el) => {
        const target = Number((el as HTMLElement).dataset.target || 0);
        const obj = { value: 0 };
        ScrollTrigger.create({
          trigger: el,
          start: "top 85%",
          once: true,
          onEnter: () => {
            gsap.to(obj, {
              value: target,
              duration: 1.2,
              ease: "power2.out",
              onUpdate: () => {
                (el as HTMLElement).textContent = `$${Math.round(obj.value)}`;
              },
            });
          },
        });
      });

      // Talent card slides from right
      const talentCard = talentRef.current?.querySelector(".talent-item");
      if (talentCard) {
        gsap.fromTo(
          talentCard,
          { opacity: 0, x: 30 },
          {
            opacity: 1, x: 0,
            duration: 0.7, ease: "power3.out",
            scrollTrigger: { trigger: talentRef.current, start: "top 70%", once: true },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="tracks"
      ref={sectionRef}
      data-navbar-theme="dark"
      className="relative py-32 md:py-44 px-8 md:px-20 lg:px-28 overflow-hidden"
      style={{ background: "#0a0a0b" }}
    >
      {/* Gradient blend */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{ height: "200px", background: "linear-gradient(to bottom, #0F0F10, #0a0a0b)" }}
      />

      <div className="relative max-w-[1400px] mx-auto">
        {/* ── Scoped Projects ── */}
        <div ref={projectRef} className="mb-20">
          <p
            className="text-xs tracking-widest uppercase mb-4"
            style={{ color: "#1d9bf0", fontFamily: "var(--font-highlight)" }}
          >
            <DecryptedText
              text="Scoped projects"
              speed={40} maxIterations={12} sequential
              characters="01!@#$%_-+=<>"
              className="text-[#1d9bf0]"
              encryptedClassName="text-[rgba(29,155,240,0.3)]"
              animateOn="view"
            />
          </p>
          <h2
            className="tracking-tight mb-4"
            style={{
              fontFamily: '"Test Sohne", sans-serif',
              fontSize: "clamp(28px, 4vw, 48px)",
              fontWeight: 500,
              color: "#F1FFFF",
              lineHeight: 1.1,
            }}
          >
            Fixed scope. Clear deliverables.
          </h2>
          <p className="text-sm mb-12" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-highlight)" }}>
            Choose a package or request a custom quote
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PROJECT_TIERS.map((tier) => (
              <SpotlightCard
                key={tier.name}
                className="tier-card rounded-xl p-7 flex flex-col"
                spotlightColor="rgba(29, 155, 240, 0.08)"
                style={{
                  background: tier.highlighted ? "rgba(29,155,240,0.04)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${tier.highlighted ? "rgba(29,155,240,0.2)" : "rgba(255,255,255,0.06)"}`,
                  opacity: 0,
                }}
              >
                {/* Tier name */}
                <div className="flex items-center justify-between mb-6">
                  <span
                    className="text-xs font-medium uppercase tracking-widest"
                    style={{ color: tier.highlighted ? "#1d9bf0" : "rgba(255,255,255,0.4)", fontFamily: "var(--font-highlight)" }}
                  >
                    {tier.name}
                  </span>
                  {tier.highlighted && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(29,155,240,0.15)", color: "#1d9bf0", border: "1px solid rgba(29,155,240,0.2)" }}
                    >
                      Popular
                    </span>
                  )}
                </div>

                {/* Price -- animated */}
                <p
                  className="text-3xl md:text-4xl font-medium tracking-tight mb-2"
                  style={{ color: "#F1FFFF", fontWeight: 500 }}
                >
                  {tier.priceNum ? (
                    <>
                      <span className="price-value" data-target={tier.priceNum}>$0</span>K
                    </>
                  ) : (
                    <DecryptedText
                      text="Custom"
                      speed={50}
                      maxIterations={8}
                      characters="$0123456789K"
                      className="text-[#F1FFFF]"
                      encryptedClassName="text-[rgba(255,255,255,0.3)]"
                      animateOn="view"
                    />
                  )}
                </p>

                {/* Description */}
                <p className="text-sm leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {tier.description}
                </p>

                {/* Features */}
                <ul className="flex flex-col gap-2.5 mt-auto">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                      <span style={{ color: "rgba(29,155,240,0.6)", fontFamily: "var(--font-highlight)", marginTop: "1px" }}>+</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </SpotlightCard>
            ))}
          </div>
        </div>

        {/* ── OR divider ── */}
        <div className="flex items-center gap-6 my-20">
          <div className="flex-1" style={{ height: "1px", background: "linear-gradient(to right, transparent, rgba(255,255,255,0.06))" }} />
          <span
            className="text-xs tracking-widest uppercase flex-shrink-0"
            style={{ color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-highlight)" }}
          >
            or
          </span>
          <div className="flex-1" style={{ height: "1px", background: "linear-gradient(to left, transparent, rgba(255,255,255,0.06))" }} />
        </div>

        {/* ── Talent Pipeline ── */}
        <div ref={talentRef}>
          <p
            className="text-xs tracking-widest uppercase mb-4"
            style={{ color: "#10b981", fontFamily: "var(--font-highlight)" }}
          >
            <DecryptedText
              text="Talent pipeline"
              speed={40} maxIterations={12} sequential
              characters="01!@#$%_-+=<>"
              className="text-[#10b981]"
              encryptedClassName="text-[rgba(16,185,129,0.3)]"
              animateOn="view"
            />
          </p>
          <h2
            className="tracking-tight mb-4"
            style={{
              fontFamily: '"Test Sohne", sans-serif',
              fontSize: "clamp(28px, 4vw, 48px)",
              fontWeight: 500,
              color: "#F1FFFF",
              lineHeight: 1.1,
            }}
          >
            Hire pre-vetted student talent.
          </h2>
          <p className="text-sm mb-12" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-highlight)" }}>
            We match, you interview, they start
          </p>

          {/* Collapsed single card with structured rows */}
          <SpotlightCard
            className="talent-item rounded-xl p-0 overflow-hidden"
            spotlightColor="rgba(16,185,129,0.08)"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderLeft: "3px solid rgba(16,185,129,0.4)",
              opacity: 0,
            }}
          >
            {TALENT_DETAILS.map((item, i) => (
              <div
                key={item.label}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8 px-7 py-5"
                style={{
                  borderBottom: i < TALENT_DETAILS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}
              >
                <p
                  className="text-xs font-medium uppercase tracking-widest flex-shrink-0 sm:w-20"
                  style={{ color: "rgba(16,185,129,0.6)", fontFamily: "var(--font-highlight)" }}
                >
                  {item.label}
                </p>
                <p className="text-base font-medium tracking-tight sm:w-32 flex-shrink-0" style={{ color: "#F1FFFF", fontWeight: 500 }}>
                  {item.value}
                </p>
                <p className="text-xs leading-relaxed flex-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </SpotlightCard>
        </div>
      </div>
    </section>
  );
}

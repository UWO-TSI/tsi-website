"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ProjectBooks from "@/components/ui/ProjectBooks";
import type { Project } from "@/components/ui/ProjectBooks";
import DecryptedText from "@/components/ui/DecryptedText";
import GradientText from "@/components/ui/GradientText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const PROJECTS: Project[] = [
  {
    org: "Childcan",
    title: "Donor management platform",
    description:
      "Full-stack donor tracking and campaign management, replacing manual spreadsheets with a streamlined dashboard.",
    tags: ["Next.js", "Supabase", "Tailwind"],
    color: "#1d9bf0",
    stats: [
      { label: "Hours saved / mo", value: "40+" },
      { label: "Active users", value: "15" },
    ],
  },
  {
    org: "Red Cross",
    title: "Volunteer coordination tool",
    description:
      "Scheduling and communication platform enabling real-time coordination across 3 regional chapters.",
    tags: ["React", "Node.js", "PostgreSQL"],
    color: "#ef4444",
    stats: [
      { label: "Volunteers", value: "200+" },
      { label: "Chapters", value: "3" },
    ],
  },
  {
    org: "World Vision",
    title: "Impact reporting dashboard",
    description:
      "Automated data pipeline and visualization dashboard for program outcomes and donor reporting.",
    tags: ["Python", "D3.js", "AWS"],
    color: "#f59e0b",
    stats: [
      { label: "Reports / quarter", value: "12" },
      { label: "Data sources", value: "8" },
    ],
  },
  {
    org: "Plan Int'l",
    title: "Community engagement app",
    description:
      "Mobile-first platform connecting field workers with communities for feedback and resource coordination.",
    tags: ["React Native", "Firebase"],
    color: "#10b981",
    stats: [
      { label: "Communities", value: "45" },
      { label: "Field workers", value: "120" },
    ],
  },
  {
    org: "IRC",
    title: "Case management system",
    description:
      "Intake, tracking, and outcomes system for refugee services, replacing paper-based workflows.",
    tags: ["Next.js", "Prisma", "Vercel"],
    color: "#8b5cf6",
    stats: [
      { label: "Cases / month", value: "300+" },
      { label: "Staff", value: "25" },
    ],
  },
  {
    org: "Museum",
    title: "Interactive exhibit guide",
    description:
      "QR-powered mobile guide for exhibits with accessibility features and multilingual support.",
    tags: ["PWA", "i18n", "QR API"],
    color: "#ec4899",
    stats: [
      { label: "Exhibits", value: "60+" },
      { label: "Languages", value: "4" },
    ],
  },
];

export default function CaseStudies() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const showcaseRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set(headerRef.current, { opacity: 1 });
        gsap.set(showcaseRef.current, { opacity: 1 });
        return;
      }

      // Scroll-driven glow
      if (glowRef.current) {
        gsap.fromTo(
          glowRef.current,
          { opacity: 0.05 },
          {
            opacity: 0.14,
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top bottom",
              end: "center center",
              scrub: true,
            },
          }
        );
      }

      // Header slides in
      gsap.fromTo(
        headerRef.current,
        { opacity: 0, x: -40 },
        {
          opacity: 1,
          x: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 70%", once: true },
        }
      );

      // Showcase scales up
      gsap.fromTo(
        showcaseRef.current,
        { opacity: 0, scale: 0.95, y: 30 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 60%", once: true },
          delay: 0.2,
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="work"
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

      {/* Scroll-driven ambient glow */}
      <div
        ref={glowRef}
        className="absolute top-1/3 right-0 pointer-events-none"
        style={{
          width: "600px",
          height: "600px",
          background: "radial-gradient(circle, rgba(29,155,240,0.12) 0%, transparent 70%)",
          filter: "blur(40px)",
          transform: "translateX(30%)",
          opacity: 0.05,
        }}
      />

      <div className="relative max-w-[1400px] mx-auto">
        <div ref={headerRef} style={{ opacity: 0 }}>
          <p
            className="text-xs tracking-widest uppercase mb-4"
            style={{ color: "#1d9bf0", fontFamily: "var(--font-highlight)" }}
          >
            <DecryptedText
              text="Past work"
              speed={40}
              maxIterations={12}
              sequential
              characters="01!@#$%_-+=<>"
              className="text-[#1d9bf0]"
              encryptedClassName="text-[rgba(29,155,240,0.3)]"
              animateOn="view"
            />
          </p>
          <h2
            className="leading-[1.1] tracking-tight mb-6"
            style={{
              fontFamily: '"Test Sohne", sans-serif',
              fontSize: "clamp(28px, 4vw, 48px)",
              fontWeight: 500,
              color: "#F1FFFF",
            }}
          >
            Real projects.{" "}
            <GradientText colors={["#1d9bf0", "#60c5ff", "#1d9bf0"]} animationSpeed={6}>
              Real impact.
            </GradientText>
          </h2>
          <p
            className="text-sm mb-16"
            style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-highlight)" }}
          >
            Hover to explore each project
          </p>
        </div>

        {/* Books Container showcase */}
        <div ref={showcaseRef} style={{ opacity: 0 }}>
          <ProjectBooks projects={PROJECTS} />
        </div>
      </div>
    </section>
  );
}

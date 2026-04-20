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

// Most recent year first (left) → past archive on the right. Year dividers are
// inserted automatically between consecutive different-year groups.
const PROJECTS: Project[] = [
  // ── 2026 cohort (most recent — left) ────────────────────────────────────
  // Placeholder slots for upcoming work show first (leading edge)
  {
    org: "ph-2026-a",
    year: 2026,
    title: "",
    description: "",
    tags: [],
    color: "#ffffff",
    placeholder: true,
  },
  {
    org: "ph-2026-b",
    year: 2026,
    title: "",
    description: "",
    tags: [],
    color: "#ffffff",
    placeholder: true,
  },
  {
    org: "World Vision",
    year: 2026,
    title: "Multi-agent research platform",
    description:
      "Internal multi-agent platform and reusable workflows to speed up research, segmentation, and proposal/project discovery.",
    tags: ["AI", "Multi-Agent", "Python"],
    color: "#f59e0b",
  },
  {
    org: "IRC",
    year: 2026,
    title: "LLM data pipeline",
    description:
      "LLM-assisted pipeline that converts inconsistent CSV/Excel provider data into a standardized schema for reliable database ingestion.",
    tags: ["LLM", "Python", "ETL"],
    color: "#1d9bf0",
  },
  {
    org: "Museum",
    year: 2026,
    title: "Astronaut spacewalk exhibit",
    description:
      "Hardware 'spacewalk repair' exhibit using a sensor glove + joystick to control a virtual hand and complete tasks.",
    tags: ["Hardware", "IoT", "Unity"],
    color: "#ec4899",
  },
  {
    org: "Childcan",
    year: 2026,
    title: "Website redesign",
    description:
      "Full redesign and migration to improve accessibility, navigation, and donation/resource flows.",
    tags: ["Next.js", "CMS", "A11y"],
    color: "#22c55e",
  },
  {
    org: "Catalyst",
    year: 2026,
    title: "ML forecasting dashboard",
    description:
      "Cloud pipeline and ML forecasting system for public development indicators, visualized in an interactive map dashboard.",
    tags: ["ML", "D3.js", "AWS"],
    color: "#ef4444",
  },
  {
    org: "Plan Int'l",
    year: 2026,
    title: "FRF reconciliation app",
    description:
      "Replacing the legacy FRF reconciliation tool with a modern web app that automates monthly expense ingestion, calculations, and reporting.",
    tags: ["React", "Node.js", "Finance"],
    color: "#8b5cf6",
  },

  // ── 2025 cohort (past archive — right) ──────────────────────────────────
  {
    org: "GoHockey",
    year: 2025,
    title: "Membership website",
    description:
      "Member registration and management site for Girls Only Hockey's youth program, with admin controls and e-commerce checkout.",
    tags: ["UI/UX", "E-Commerce", "Web Dev", "Accounts"],
    color: "#8b5cf6",
  },
  {
    org: "JAM",
    year: 2025,
    title: "RFID interactive exhibit",
    description:
      "Hardware + software system for London Jet Aircraft Museum: RFID-tagged exhibits trigger an interactive immersive experience for visitors.",
    tags: ["RFID", "Hardware", "Full-Stack", "Electronics"],
    color: "#0ea5e9",
  },
  {
    org: "United Way",
    year: 2025,
    title: "StairClimb leaderboard app",
    description:
      "Gamified web app for United Way Elgin-Middlesex's TD StairClimb: tracks participants' steps and displays a live leaderboard.",
    tags: ["React", "SQL", "Game Dev", "UI/UX"],
    color: "#ef4444",
  },
  {
    org: "TREA",
    year: 2025,
    title: "Digital outreach",
    description:
      "Tech consulting for Thames Region Ecological Association: social platforms and digital tools to engage youth in environmental initiatives.",
    tags: ["Consulting", "Social Media", "Strategy"],
    color: "#4d9c3f",
  },
  {
    org: "BGC",
    year: 2025,
    title: "Campaign tracking tool",
    description:
      "Marketing-attribution tool for Boys & Girls Club London: unique URLs + QR codes per channel, all landing on a tracked conversion page.",
    tags: ["Backend", "Analytics", "Database", "QR Codes"],
    color: "#22c55e",
  },
  {
    org: "YOU",
    year: 2025,
    title: "Workflow management software",
    description:
      "Internal tool for Youth Opportunities Unlimited to manage workshop tasks, tie them to soft/hard skills, and auto-generate completion e-certificates.",
    tags: ["Fullstack", "Database", "API", "Automation"],
    color: "#1d9bf0",
  },
  {
    org: "Daya Counselling",
    year: 2025,
    title: "Website modernization",
    description:
      "Redesign and upgrade of Daya Counselling Centre's WordPress site for a modern, accessible, user-friendly presence.",
    tags: ["HTML", "CSS", "Figma", "Web Hosting"],
    color: "#6b5ce7",
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

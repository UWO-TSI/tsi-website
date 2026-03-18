"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Cormorant_Garamond, Inter, Space_Mono } from "next/font/google";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* ─── Fonts ───────────────────────────────────────────────────────────── */

const cgFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--f-cg",
  display: "swap",
});

const interFont = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--f-inter",
  display: "swap",
});

const monoFont = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--f-mono",
  display: "swap",
});

/* ─── Palette ─────────────────────────────────────────────────────────── */

const C = {
  bg:     "#F7F5F0",
  ink:    "#0F0D0B",
  blue:   "#0F2FD4",
  muted:  "#7A7268",
  dim:    "#3D3A36",
  card:   "#EDEBE4",
  dark:   "#0F0D0B",
  ds:     "#1A1714",
  cream:  "#F5F2EB",
  rule:   "rgba(15,13,11,0.1)",
  amber:  "#C4956A",
} as const;

/* ─── Style helpers ───────────────────────────────────────────────────── */

const cg = (size: string | number, weight = 400, italic = false): CSSProperties => ({
  fontFamily: "var(--f-cg), Georgia, serif",
  fontSize: typeof size === "number" ? `${size}px` : size,
  fontWeight: weight,
  fontStyle: italic ? "italic" : "normal",
  lineHeight: 1.05,
  letterSpacing: "-0.02em",
});

const it = (size: string | number = 16, weight = 400): CSSProperties => ({
  fontFamily: "var(--f-inter), system-ui, sans-serif",
  fontSize: typeof size === "number" ? `${size}px` : size,
  fontWeight: weight,
  lineHeight: 1.65,
});

const mn = (size: string | number = 11, weight = 400): CSSProperties => ({
  fontFamily: "var(--f-mono), 'Courier New', monospace",
  fontSize: typeof size === "number" ? `${size}px` : size,
  fontWeight: weight,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
});

/* ─── Data ────────────────────────────────────────────────────────────── */

const processSteps = [
  { num: "01", phase: "Application", duration: "2 weeks",
    desc: "Nonprofits submit a brief application describing their mission and technical needs. We select based on impact potential and feasibility.",
    visual: "form" },
  { num: "02", phase: "Discovery", duration: "3 weeks",
    desc: "We embed with your team. Stakeholder interviews, workflow mapping, and requirements gathering produce a single clear project brief.",
    visual: "research" },
  { num: "03", phase: "Design", duration: "4 weeks",
    desc: "Information architecture, wireframes, and a high-fidelity prototype. You iterate until the solution feels native to your organization.",
    visual: "design" },
  { num: "04", phase: "Development", duration: "16 weeks",
    desc: "Sprint-based engineering with biweekly demos. Working software ships early. You steer direction throughout.",
    visual: "code" },
  { num: "05", phase: "Handoff", duration: "3 weeks",
    desc: "Production deployment, staff training, technical documentation, and 30 days of post-launch support. No strings attached.",
    visual: "launch" },
];

const deliverables = [
  { title: "Production-Ready Software", desc: "Deployed, tested, and ready for your organization from day one. Hosted, monitored, and performant." },
  { title: "Full Source Code", desc: "Complete repository with clean architecture. Yours to own, modify, and extend forever." },
  { title: "Design System", desc: "Figma source files, component library, brand integration, and all visual assets." },
  { title: "Technical Documentation", desc: "Architecture decisions, API docs, deployment guides. Any developer can pick it up." },
  { title: "Staff Training", desc: "Hands-on sessions with your team. Recorded walkthroughs for future reference." },
  { title: "Impact Report", desc: "Project outcomes, usage metrics, and recommendations for continued development." },
];

const projects = [
  { name: "Donor Nexus", org: "BrightAid", desc: "Recurring giving portal with wallet pay and donor analytics.", tags: ["Next.js", "Stripe", "Postgres"] },
  { name: "Hearth", org: "ShelterNet", desc: "Privacy-safe case tracking with grant-ready exports.", tags: ["React", "Supabase", "Auth"] },
  { name: "Green Routes", org: "FoodBridge", desc: "Route batching, live ETAs, and volunteer mobile handoffs.", tags: ["Mapbox", "Node", "Redis"] },
  { name: "Pathways", org: "YouthRise", desc: "Mentor-mentee matching based on goals, time, and proximity.", tags: ["Next.js", "Postgres", "Clerk"] },
  { name: "Grant Glass", org: "GrantWorks", desc: "Milestone tracker with exportable narratives and budget rollups.", tags: ["Supabase", "React", "Tailwind"] },
  { name: "Pulse", org: "HealthConnect", desc: "Mobile-first intake with scoring and care-path suggestions.", tags: ["Next.js", "Zod", "Prisma"] },
];

/* ─── Global CSS ──────────────────────────────────────────────────────── */

const PAGE_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* Film grain overlay */
  .page-grain::after {
    content: '';
    position: fixed;
    inset: -100%;
    width: 300%;
    height: 300%;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    opacity: 0.028;
    pointer-events: none;
    z-index: 10000;
    animation: grain 6s steps(8) infinite;
  }

  @keyframes grain {
    0%, 100% { transform: translate(0, 0); }
    10% { transform: translate(-2%, -3%); }
    20% { transform: translate(-5%, 2%); }
    30% { transform: translate(3%, -8%); }
    40% { transform: translate(-2%, 8%); }
    50% { transform: translate(-5%, 3%); }
    60% { transform: translate(5%, 0%); }
    70% { transform: translate(0%, 5%); }
    80% { transform: translate(1%, 10%); }
    90% { transform: translate(-3%, 3%); }
  }

  /* Marquee */
  @keyframes marquee-l { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  @keyframes marquee-r { from { transform: translateX(-50%); } to { transform: translateX(0); } }
  .marquee-l { animation: marquee-l 30s linear infinite; }
  .marquee-r { animation: marquee-r 30s linear infinite; }

  /* Horizontal scroll */
  .h-scroll-track { will-change: transform; }

  /* Responsive */
  @media (max-width: 768px) {
    .process-panel { min-width: 85vw !important; }
    .bento-grid { grid-template-columns: 1fr !important; }
    .bento-featured { grid-column: span 1 !important; }
    .proj-grid { grid-template-columns: 1fr !important; }
    .stat-grid { grid-template-columns: 1fr 1fr !important; }
    .hero-deco { display: none !important; }
  }
`;

/* ─── Components ──────────────────────────────────────────────────────── */

function Divider({ color = C.rule }: { color?: string }) {
  return <div style={{ width: "100%", height: 1, background: color }} />;
}

function Label({ children, color = C.muted }: { children: string; color?: string }) {
  return (
    <span style={{ ...mn(11), color, display: "block", marginBottom: 20, letterSpacing: "0.3em" }}>
      {children}
    </span>
  );
}

/* ── SplitLine: each word in overflow:hidden mask for reveal ────────── */
function SplitLine({ children, style }: { children: string; style?: CSSProperties }) {
  const words = children.split(" ");
  return (
    <span style={{ display: "block", ...style }}>
      {words.map((word, i) => (
        <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom" }}>
          <span
            className="hero-word"
            style={{
              display: "inline-block",
              transform: "translateY(115%)",
              willChange: "transform",
            }}
          >
            {word}
          </span>
          {i < words.length - 1 && <span className="hero-word" style={{ display: "inline-block", transform: "translateY(115%)" }}>&nbsp;</span>}
        </span>
      ))}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   HERO — Kinetic typography, decorative year mark, gradient orb
   ═══════════════════════════════════════════════════════════════════════ */

function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Word-by-word reveal
      gsap.to(".hero-word", {
        y: 0,
        stagger: 0.05,
        duration: 1.6,
        ease: "power4.out",
        delay: 0.4,
      });

      // Bottom bar fade in
      gsap.fromTo(
        bottomRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 1.0, ease: "power3.out", delay: 1.2 }
      );

      // Horizontal line draw
      gsap.fromTo(
        lineRef.current,
        { scaleX: 0 },
        { scaleX: 1, duration: 1.4, ease: "power3.inOut", delay: 0.8 }
      );

      // Parallax on scroll
      gsap.to(".hero-content", {
        y: -80,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 1.5,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Mouse-following gradient orb
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!orbRef.current || !sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    orbRef.current.style.transform = `translate(${x - 200}px, ${y - 200}px)`;
  };

  return (
    <section
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      style={{
        background: `radial-gradient(ellipse at 30% 50%, #181510, ${C.dark})`,
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        padding: "clamp(24px, 4vw, 48px)",
        position: "relative",
        overflow: "hidden",
        cursor: "default",
      }}
    >
      {/* Mouse-following orb */}
      <div
        ref={orbRef}
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${C.blue}15, transparent 70%)`,
          pointerEvents: "none",
          transition: "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 0,
        }}
      />

      {/* Decorative year mark */}
      <div
        className="hero-deco"
        style={{
          position: "absolute",
          right: "clamp(-40px, 2vw, 40px)",
          top: "50%",
          transform: "translateY(-50%)",
          ...cg("clamp(200px, 28vw, 400px)", 300),
          color: "rgba(245, 242, 235, 0.025)",
          lineHeight: 0.85,
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 0,
        }}
      >
        26
      </div>

      {/* Nav */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "relative",
          zIndex: 2,
        }}
      >
        <span style={{ ...mn(11, 700), color: C.cream }}>TETHOS</span>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ ...mn(10), color: C.muted }}>NPO Program</span>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: C.amber }} />
          <span style={{ ...mn(10), color: C.muted }}>2026</span>
        </div>
      </nav>

      {/* Headline */}
      <div
        className="hero-content"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          paddingBlock: "clamp(48px, 8vh, 120px)",
          position: "relative",
          zIndex: 2,
        }}
      >
        <h1 style={{ ...cg("clamp(80px, 12vw, 180px)", 400), color: C.cream, maxWidth: "13ch" }}>
          <SplitLine>Software</SplitLine>
          <SplitLine>That Serves</SplitLine>
          <SplitLine style={{ fontStyle: "italic", fontWeight: 300, color: "#A8A29E" }}>
            a Purpose.
          </SplitLine>
        </h1>
      </div>

      {/* Horizontal line */}
      <div
        ref={lineRef}
        style={{
          width: "100%",
          height: 1,
          background: `linear-gradient(90deg, ${C.cream}40, ${C.cream}10)`,
          transformOrigin: "left center",
          transform: "scaleX(0)",
          position: "relative",
          zIndex: 2,
        }}
      />

      {/* Bottom bar */}
      <div
        ref={bottomRef}
        style={{
          opacity: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 24,
          gap: 24,
          flexWrap: "wrap",
          position: "relative",
          zIndex: 2,
        }}
      >
        <p style={{ ...it(14, 300), color: C.muted, maxWidth: 440 }}>
          An 8-month pro-bono initiative — from discovery to deployment,
          at no cost to your organization.
        </p>
        <a
          href="#apply"
          style={{
            ...mn(10, 700),
            color: C.cream,
            background: C.blue,
            padding: "16px 32px",
            borderRadius: 2,
            textDecoration: "none",
            letterSpacing: "0.15em",
            whiteSpace: "nowrap",
            transition: "background 0.3s",
          }}
          onMouseEnter={(e) => { (e.currentTarget).style.background = "#1238E0"; }}
          onMouseLeave={(e) => { (e.currentTarget).style.background = C.blue; }}
        >
          Apply Now ↗
        </a>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MARQUEE — Dual row, counter-scroll, mixed typography
   ═══════════════════════════════════════════════════════════════════════ */

function Marquee() {
  const row1 = ["Pro-bono", "Production-ready", "No cost", "Real impact", "20+ projects", "Discovery to deployment"];
  const row2 = ["Built by students", "8 months", "For nonprofits", "Open source", "No strings attached", "Western University"];
  const doubled1 = [...row1, ...row1];
  const doubled2 = [...row2, ...row2];

  return (
    <div style={{ background: C.bg, overflow: "hidden", paddingBlock: 20, borderBottom: `1px solid ${C.rule}` }}>
      {/* Row 1 — left scroll, serif */}
      <div className="marquee-l" style={{ display: "flex", width: "max-content", marginBottom: 8 }}>
        {doubled1.map((item, i) => (
          <span
            key={i}
            style={{
              ...cg(20, 400, true),
              color: C.dim,
              padding: "0 clamp(24px, 4vw, 56px)",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: "clamp(24px, 4vw, 56px)",
            }}
          >
            {item}
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.amber, display: "inline-block", flexShrink: 0 }} />
          </span>
        ))}
      </div>
      {/* Row 2 — right scroll, mono */}
      <div className="marquee-r" style={{ display: "flex", width: "max-content" }}>
        {doubled2.map((item, i) => (
          <span
            key={i}
            style={{
              ...mn(10),
              color: C.muted,
              padding: "0 clamp(24px, 4vw, 56px)",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: "clamp(24px, 4vw, 56px)",
            }}
          >
            {item}
            <span style={{ color: C.rule }}>·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SCROLL REVEAL QUOTE — Word-by-word opacity on scroll (signature move)
   ═══════════════════════════════════════════════════════════════════════ */

function ScrollRevealQuote() {
  const sectionRef = useRef<HTMLElement>(null);
  const quoteText =
    "We're not a consultancy. We're a collective of students who believe nonprofits deserve the same software as Fortune 500 companies — and we prove it, one project at a time.";
  const words = quoteText.split(" ");

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const wordEls = el.querySelectorAll(".q-word");

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "bottom bottom",
          pin: ".q-pin",
          scrub: 1,
        },
      });

      wordEls.forEach((word) => {
        tl.to(word, { opacity: 1, duration: 0.08 }, "+=0.01");
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} style={{ minHeight: "300vh", position: "relative" }}>
      <div
        className="q-pin"
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: C.bg,
          padding: "clamp(24px, 8vw, 120px)",
          position: "relative",
        }}
      >
        {/* Large decorative quote mark */}
        <div
          style={{
            position: "absolute",
            top: "12%",
            left: "clamp(24px, 8vw, 120px)",
            ...cg("clamp(120px, 20vw, 300px)", 300),
            color: `${C.blue}08`,
            lineHeight: 1,
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          &ldquo;
        </div>

        <p
          style={{
            ...cg("clamp(32px, 5vw, 72px)", 400),
            color: C.ink,
            lineHeight: 1.25,
            maxWidth: 1000,
            position: "relative",
            zIndex: 1,
          }}
        >
          {words.map((word, i) => (
            <span
              key={i}
              className="q-word"
              style={{
                opacity: 0.08,
                transition: "none",
                display: "inline",
              }}
            >
              {word}{" "}
            </span>
          ))}
        </p>

        {/* Attribution */}
        <div
          style={{
            position: "absolute",
            bottom: "clamp(32px, 6vh, 64px)",
            left: "clamp(24px, 8vw, 120px)",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ width: 24, height: 1, background: C.blue }} />
          <span style={{ ...mn(10), color: C.blue }}>The Tethos Manifesto</span>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   STATS — Asymmetric bento: one featured stat + three smaller
   ═══════════════════════════════════════════════════════════════════════ */

function Stats() {
  const ref = useRef<HTMLElement>(null);
  const numRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const data = [
    { val: 20, suffix: "+", label: "Projects Completed", featured: true },
    { val: 150, suffix: "+", label: "Alumni & Members", featured: false },
    { val: 200, suffix: "K+", label: "Value Delivered ($)", featured: false },
    { val: 8, suffix: " mo", label: "Per Project", featured: false },
  ];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      // Counter animations
      data.forEach((s, i) => {
        const numEl = numRefs.current[i];
        if (!numEl) return;
        gsap.fromTo(
          { v: 0 },
          { v: s.val },
          {
            duration: 2.0,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 75%", toggleActions: "play none none none" },
            onUpdate: function () {
              if (numEl) numEl.textContent = String(Math.round(this.targets()[0].v));
            },
          }
        );
      });

      // Stagger reveal
      gsap.fromTo(
        el.querySelectorAll(".stat-cell"),
        { opacity: 0, y: 40 },
        {
          opacity: 1, y: 0, duration: 1.2, ease: "power3.out", stagger: 0.12,
          scrollTrigger: { trigger: el, start: "top 75%", toggleActions: "play none none none" },
        }
      );
    });
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={ref}
      style={{
        background: C.dark,
        padding: "clamp(80px, 10vw, 140px) clamp(24px, 6vw, 80px)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 64 }}>
          <Label color="#5A5650">By The Numbers</Label>
        </div>

        <div
          className="stat-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 1fr 1fr 1fr",
            gap: 2,
          }}
        >
          {data.map((s, i) => (
            <div
              key={s.label}
              className="stat-cell"
              style={{
                opacity: 0,
                background: C.ds,
                padding: i === 0 ? "clamp(40px, 5vw, 64px)" : "clamp(32px, 4vw, 48px)",
                borderRadius: i === 0 ? "6px 0 0 6px" : i === 3 ? "0 6px 6px 0" : 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                minHeight: i === 0 ? 240 : 200,
              }}
            >
              <div
                style={{
                  ...mn(i === 0 ? "clamp(56px, 7vw, 96px)" : "clamp(36px, 4.5vw, 56px)", 700),
                  color: i === 0 ? C.blue : C.cream,
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "baseline",
                }}
              >
                <span ref={(el) => { numRefs.current[i] = el; }}>{s.val}</span>
                <span style={{ fontSize: "0.55em", color: i === 0 ? C.blue : "#5A5650" }}>{s.suffix}</span>
              </div>
              <p style={{ ...it(13, 300), color: "#5A5650", lineHeight: 1.4 }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PROCESS — Horizontal scroll, pinned, large background numbers
   ═══════════════════════════════════════════════════════════════════════ */

function Process() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

    const ctx = gsap.context(() => {
      const totalWidth = track.scrollWidth;
      const viewWidth = window.innerWidth;

      gsap.to(track, {
        x: -(totalWidth - viewWidth),
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${totalWidth - viewWidth}`,
          pin: true,
          scrub: 1.5,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      // Reveal each panel
      track.querySelectorAll(".process-panel").forEach((panel) => {
        gsap.fromTo(
          panel.querySelector(".panel-content"),
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: panel,
              containerAnimation: gsap.getById?.("h-scroll") || undefined,
              start: "left 80%",
              toggleActions: "play none none none",
            },
          }
        );
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{
        overflow: "hidden",
        background: C.bg,
      }}
    >
      {/* Section label */}
      <div
        ref={trackRef}
        className="h-scroll-track"
        style={{
          display: "flex",
          width: "fit-content",
          minHeight: "100vh",
        }}
      >
        {/* Intro panel */}
        <div
          style={{
            minWidth: "clamp(400px, 45vw, 600px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "clamp(40px, 6vw, 100px)",
            borderRight: `1px solid ${C.rule}`,
          }}
        >
          <Label>The Process</Label>
          <h2 style={{ ...cg("clamp(48px, 6vw, 88px)", 400), color: C.ink, marginBottom: 24 }}>
            Five phases.
            <br />
            <em style={{ fontWeight: 300, color: C.muted }}>One outcome.</em>
          </h2>
          <p style={{ ...it(16, 300), color: C.dim, maxWidth: 360 }}>
            Every engagement follows the same rigorous framework.
            Scroll to explore each phase.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 40 }}>
            <span style={{ ...mn(9), color: C.muted }}>Scroll →</span>
            <div style={{ width: 40, height: 1, background: C.rule }} />
          </div>
        </div>

        {/* Process panels */}
        {processSteps.map((step, i) => (
          <div
            key={step.num}
            className="process-panel"
            style={{
              minWidth: "clamp(360px, 40vw, 520px)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "clamp(40px, 6vw, 80px)",
              borderRight: i < processSteps.length - 1 ? `1px solid ${C.rule}` : "none",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Giant background number */}
            <div
              style={{
                position: "absolute",
                bottom: -20,
                right: -10,
                ...mn("clamp(160px, 20vw, 280px)", 700),
                color: `${C.ink}05`,
                lineHeight: 1,
                userSelect: "none",
                pointerEvents: "none",
                letterSpacing: "-0.05em",
              }}
            >
              {step.num}
            </div>

            <div className="panel-content" style={{ position: "relative", zIndex: 1 }}>
              <span
                style={{
                  ...mn(11, 700),
                  color: C.blue,
                  display: "block",
                  marginBottom: 32,
                }}
              >
                Phase {step.num}
              </span>
              <h3 style={{ ...cg("clamp(36px, 4vw, 56px)", 500), color: C.ink, marginBottom: 16 }}>
                {step.phase}
              </h3>
              <span
                style={{
                  ...mn(9),
                  color: C.amber,
                  display: "block",
                  marginBottom: 24,
                }}
              >
                Duration: {step.duration}
              </span>
              <p style={{ ...it(15, 300), color: C.dim, lineHeight: 1.7, maxWidth: 340 }}>
                {step.desc}
              </p>

              {/* Progress indicator */}
              <div style={{ display: "flex", gap: 6, marginTop: 48 }}>
                {processSteps.map((_, j) => (
                  <div
                    key={j}
                    style={{
                      width: j === i ? 32 : 8,
                      height: 3,
                      borderRadius: 2,
                      background: j === i ? C.blue : C.rule,
                      transition: "width 0.3s",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DELIVERABLES — Bento grid with featured first card
   ═══════════════════════════════════════════════════════════════════════ */

function Deliverables() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.querySelectorAll(".bento-card"),
        { opacity: 0, y: 48, scale: 0.97 },
        {
          opacity: 1, y: 0, scale: 1, duration: 1.0, ease: "power3.out", stagger: 0.1,
          scrollTrigger: { trigger: el, start: "top 70%", toggleActions: "play none none none" },
        }
      );
    });
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={ref}
      style={{
        background: C.dark,
        padding: "clamp(80px, 10vw, 140px) clamp(24px, 6vw, 80px)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 64 }}>
          <Label color="#5A5650">What You Receive</Label>
          <h2 style={{ ...cg("clamp(40px, 5vw, 72px)", 400), color: C.cream }}>
            Everything you need.
            <br />
            <em style={{ fontWeight: 300, color: "#5A5650" }}>Nothing more.</em>
          </h2>
        </div>

        <div
          className="bento-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 2,
          }}
        >
          {deliverables.map((d, i) => (
            <div
              key={d.title}
              className={`bento-card ${i === 0 ? "bento-featured" : ""}`}
              style={{
                opacity: 0,
                background: C.ds,
                padding: "clamp(32px, 4vw, 56px)",
                gridColumn: i === 0 ? "span 2" : "span 1",
                gridRow: i === 0 ? "span 1" : "span 1",
                borderRadius:
                  i === 0 ? "6px 0 0 0" :
                  i === 2 ? "0 6px 0 0" :
                  i === 3 ? "0 0 0 6px" :
                  i === 5 ? "0 0 6px 0" : 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                minHeight: i === 0 ? 280 : 220,
                transition: "background 0.4s",
                cursor: "default",
              }}
              onMouseEnter={(e) => { (e.currentTarget).style.background = "#221F1B"; }}
              onMouseLeave={(e) => { (e.currentTarget).style.background = C.ds; }}
            >
              <span
                style={{
                  ...mn(9),
                  color: C.blue,
                  marginBottom: 24,
                  letterSpacing: "0.3em",
                }}
              >
                0{i + 1}
              </span>
              <h3
                style={{
                  ...cg(i === 0 ? "clamp(28px, 3vw, 40px)" : "clamp(22px, 2.2vw, 32px)", 500),
                  color: C.cream,
                  marginBottom: 12,
                  lineHeight: 1.15,
                }}
              >
                {d.title}
              </h3>
              <p style={{ ...it(14, 300), color: "#6B6560", lineHeight: 1.6 }}>
                {d.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PROJECTS — Grid with hover reveals
   ═══════════════════════════════════════════════════════════════════════ */

function Projects() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.querySelectorAll(".proj-card"),
        { opacity: 0, y: 40 },
        {
          opacity: 1, y: 0, duration: 1.0, ease: "power3.out", stagger: 0.08,
          scrollTrigger: { trigger: el.querySelector(".proj-grid"), start: "top 75%", toggleActions: "play none none none" },
        }
      );
    });
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={ref}
      style={{
        background: C.bg,
        padding: "clamp(80px, 10vw, 140px) clamp(24px, 6vw, 80px)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: 64,
            flexWrap: "wrap",
            gap: 24,
          }}
        >
          <div>
            <Label>Project Gallery · 2025 / 2026</Label>
            <h2 style={{ ...cg("clamp(40px, 5vw, 72px)", 400), color: C.ink }}>
              Real work.
              <br />
              <em style={{ fontWeight: 300, color: C.muted }}>Real nonprofits.</em>
            </h2>
          </div>
          <span style={{ ...mn(10), color: C.muted }}>
            {projects.length} of 20+ projects
          </span>
        </div>

        <div
          className="proj-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "clamp(12px, 1.5vw, 16px)",
          }}
        >
          {projects.map((p, i) => (
            <div
              key={p.name}
              className="proj-card"
              style={{
                opacity: 0,
                background: C.ink,
                borderRadius: 6,
                overflow: "hidden",
                cursor: "default",
                transition: "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.5s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget).style.transform = "translateY(-6px)";
                (e.currentTarget).style.boxShadow = "0 32px 64px rgba(0,0,0,0.28)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget).style.transform = "translateY(0)";
                (e.currentTarget).style.boxShadow = "none";
              }}
            >
              {/* Color accent bar */}
              <div style={{ height: 3, background: C.blue, opacity: 0.6 }} />

              <div style={{ padding: "clamp(24px, 3vw, 36px)" }}>
                {/* Index + Org */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <span style={{ ...mn(9), color: C.blue }}>
                    {p.org}
                  </span>
                  <span style={{ ...mn(8), color: "#3A3632" }}>
                    0{i + 1}
                  </span>
                </div>

                <h3 style={{ ...cg("clamp(24px, 2.5vw, 32px)", 500), color: C.cream, marginBottom: 12 }}>
                  {p.name}
                </h3>
                <p style={{ ...it(13, 300), color: "#6B6560", marginBottom: 24, lineHeight: 1.6 }}>
                  {p.desc}
                </p>

                {/* Tags */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {p.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        ...mn(8),
                        color: "#5A5650",
                        border: "1px solid #2A2724",
                        padding: "3px 8px",
                        borderRadius: 2,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TESTIMONIAL — Full viewport, scale parallax, giant quote mark
   ═══════════════════════════════════════════════════════════════════════ */

function Testimonial() {
  const ref = useRef<HTMLElement>(null);
  const quoteRef = useRef<HTMLQuoteElement>(null);

  useEffect(() => {
    const el = ref.current;
    const q = quoteRef.current;
    if (!el || !q) return;
    const ctx = gsap.context(() => {
      // Quote reveal
      gsap.fromTo(
        q,
        { opacity: 0, y: 56 },
        {
          opacity: 1, y: 0, duration: 1.6, ease: "power3.out",
          scrollTrigger: { trigger: q, start: "top 80%", toggleActions: "play none none none" },
        }
      );

      // Subtle scale-up on scroll
      gsap.fromTo(
        q,
        { scale: 0.95 },
        {
          scale: 1,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "bottom top",
            scrub: 2,
          },
        }
      );
    });
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={ref}
      style={{
        background: `radial-gradient(ellipse at 50% 60%, #181510, ${C.dark})`,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(60px, 10vw, 120px) clamp(24px, 8vw, 120px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Giant decorative quote mark */}
      <div
        style={{
          position: "absolute",
          top: "8%",
          left: "clamp(40px, 10vw, 160px)",
          ...cg("clamp(200px, 30vw, 500px)", 300),
          color: `${C.cream}03`,
          lineHeight: 1,
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        &ldquo;
      </div>

      <blockquote
        ref={quoteRef}
        style={{ opacity: 0, maxWidth: 900, textAlign: "center", position: "relative", zIndex: 1 }}
      >
        <p
          style={{
            ...cg("clamp(28px, 4vw, 56px)", 400, true),
            color: C.cream,
            lineHeight: 1.3,
            marginBottom: 56,
          }}
        >
          &ldquo;Working with Tethos transformed how we serve our community. They didn&rsquo;t just build software — they took the time to understand our mission and delivered something we could actually sustain.&rdquo;
        </p>
        <footer>
          <div
            style={{
              width: 32,
              height: 1,
              background: C.amber,
              margin: "0 auto 20px",
            }}
          />
          <p style={{ ...mn(11, 700), color: C.cream, marginBottom: 4 }}>
            Maria Chen
          </p>
          <p style={{ ...mn(9), color: "#5A5650" }}>
            Executive Director · BrightAid Foundation
          </p>
        </footer>
      </blockquote>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   CTA — Clean, generous, final impression
   ═══════════════════════════════════════════════════════════════════════ */

function CTA() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.querySelector(".cta-inner"),
        { opacity: 0, y: 48 },
        {
          opacity: 1, y: 0, duration: 1.2, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 70%", toggleActions: "play none none none" },
        }
      );
    });
    return () => ctx.revert();
  }, []);

  return (
    <section
      id="apply"
      ref={ref}
      style={{
        background: C.bg,
        padding: "clamp(120px, 16vw, 220px) clamp(24px, 8vw, 120px)",
        textAlign: "center",
        position: "relative",
      }}
    >
      {/* Subtle top line */}
      <div style={{ position: "absolute", top: 0, left: "clamp(24px, 8vw, 120px)", right: "clamp(24px, 8vw, 120px)", height: 1, background: C.rule }} />

      <div className="cta-inner" style={{ opacity: 0 }}>
        <Label color={C.muted}>Applications Open · 2026 Cohort</Label>
        <h2
          style={{
            ...cg("clamp(48px, 8vw, 120px)", 400),
            color: C.ink,
            marginBottom: "clamp(24px, 4vw, 40px)",
            lineHeight: 1.05,
          }}
        >
          Ready to
          <br />
          <em style={{ fontWeight: 300, fontStyle: "italic", color: C.muted }}>
            transform?
          </em>
        </h2>
        <p
          style={{
            ...it(17, 300),
            color: C.dim,
            maxWidth: 480,
            margin: "0 auto clamp(48px, 6vw, 72px)",
            lineHeight: 1.7,
          }}
        >
          Join the nonprofits already building with Tethos.
          No cost. No catch. Just real software.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a
            href="#"
            style={{
              ...mn(10, 700),
              color: C.cream,
              background: C.blue,
              padding: "18px 44px",
              borderRadius: 2,
              textDecoration: "none",
              letterSpacing: "0.15em",
              display: "inline-block",
              transition: "background 0.3s, transform 0.3s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget).style.background = "#1238E0";
              (e.currentTarget).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget).style.background = C.blue;
              (e.currentTarget).style.transform = "translateY(0)";
            }}
          >
            Apply Now
          </a>
          <a
            href="#"
            style={{
              ...mn(10, 400),
              color: C.dim,
              border: `1px solid ${C.rule}`,
              padding: "18px 44px",
              borderRadius: 2,
              textDecoration: "none",
              letterSpacing: "0.15em",
              display: "inline-block",
              transition: "border-color 0.3s, color 0.3s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget).style.borderColor = C.ink;
              (e.currentTarget).style.color = C.ink;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget).style.borderColor = C.rule;
              (e.currentTarget).style.color = C.dim;
            }}
          >
            Download Package
          </a>
        </div>

        {/* Footer */}
        <div style={{ marginTop: "clamp(80px, 10vw, 140px)" }}>
          <Divider />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: 20,
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <span style={{ ...mn(9), color: "#C4C0BB" }}>
              Tethos · Western University · Student Technology Initiative
            </span>
            <span style={{ ...mn(9), color: "#C4C0BB" }}>
              © 2026
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════════ */

export default function NPOTestPage() {
  return (
    <div
      className={`page-grain ${cgFont.variable} ${interFont.variable} ${monoFont.variable}`}
      style={{ background: C.bg, overflowX: "hidden" }}
    >
      <style>{PAGE_CSS}</style>
      <Hero />
      <Marquee />
      <ScrollRevealQuote />
      <Stats />
      <Process />
      <Deliverables />
      <Projects />
      <Testimonial />
      <CTA />
    </div>
  );
}

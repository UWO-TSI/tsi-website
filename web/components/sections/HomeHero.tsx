"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import GlobeVisualizer from "@/components/ui/GlobeVisualizer";
import ScrollIndicator from "@/components/ui/ScrollIndicator";
import GlowLogoCarousel from "@/components/ui/GlowLogoCarousel";
import { HERO_LOGOS } from "@/components/ui/PartnerLogos";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* ── Character-split helper ── */
function SplitLine({
  text,
  className,
  style,
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={className} style={{ display: "block", ...style }}>
      {text.split("").map((ch, i) => (
        <span
          key={i}
          className="hero-char"
          style={{
            display: "inline-block",
            overflow: "hidden",
          }}
        >
          <span
            className="hero-char-inner"
            style={{
              display: "inline-block",
              transform: "translateY(110%)",
              willChange: "transform",
            }}
          >
            {ch === " " ? "\u00A0" : ch}
          </span>
        </span>
      ))}
    </span>
  );
}

export default function HomeHero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const logoStripRef = useRef<HTMLDivElement>(null);
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const globeWrapRef = useRef<HTMLDivElement>(null);
  const topLeftRef = useRef<HTMLDivElement>(null);
  const bottomRightRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  // ── Entrance animation ──
  useEffect(() => {
    if (!h1Ref.current || !scrollIndicatorRef.current) return;

    const chars = h1Ref.current.querySelectorAll(".hero-char-inner");
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      gsap.set(chars, { y: 0 });
      gsap.set(h1Ref.current, { opacity: 1 });
      if (logoStripRef.current) gsap.set(logoStripRef.current, { opacity: 1 });
      if (lineRef.current) gsap.set(lineRef.current, { scaleX: 1, opacity: 1 });
      gsap.set(scrollIndicatorRef.current, { opacity: 1 });
      return;
    }

    const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

    // Credential bar fades in first
    if (logoStripRef.current) {
      tl.fromTo(
        logoStripRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" },
        0.1
      );
    }

    // Divider draws in
    if (lineRef.current) {
      tl.fromTo(
        lineRef.current,
        { scaleX: 0, opacity: 0 },
        { scaleX: 1, opacity: 1, duration: 0.7, ease: "power2.inOut" },
        0.35
      );
    }

    // h1 becomes visible (chars are clipped)
    tl.set(h1Ref.current, { opacity: 1 }, 0.5);

    // Staggered character reveal - clip from below
    tl.to(chars, {
      y: 0,
      duration: 0.8,
      stagger: 0.02,
      ease: "power3.out",
    }, 0.55);

    // Scroll indicator
    tl.fromTo(
      scrollIndicatorRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.5 },
      1.2
    );
  }, []);

  // ── Scroll animations ──
  useEffect(() => {
    if (
      !sectionRef.current ||
      !headingRef.current ||
      !globeWrapRef.current ||
      !topLeftRef.current ||
      !bottomRightRef.current
    )
      return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        headingRef.current,
        { y: 0, opacity: 1 },
        {
          y: 0,
          opacity: 0,
          ease: "power3.in",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: "top+=8% top",
            scrub: true,
          },
        }
      );

      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "top+=300 top",
        scrub: true,
        onUpdate: (self) => {
          const opacity = Math.max(0, 1 - self.progress * 2);
          gsap.set(scrollIndicatorRef.current, { opacity });
        },
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: globeWrapRef.current,
          start: "center center",
          end: "+=100%",
          scrub: true,
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
        },
      });

      tl.fromTo(
        topLeftRef.current,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" },
        0
      );

      tl.fromTo(
        bottomRightRef.current,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" },
        0.5
      );
    }, sectionRef);

    const refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 150);

    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 200);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      ctx.revert();
      clearTimeout(refreshTimer);
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <section id="hero" ref={sectionRef} data-navbar-theme="dark" className="relative bg-[#10121a]">
      {/* Atmospheric radial glow */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 50% 38%, rgba(255,255,255,0.022) 0%, transparent 70%)",
        }}
      />

      {/* Subtle noise grain overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      {/* ── Heading — fixed to viewport ── */}
      <div
        ref={headingRef}
        className="fixed top-0 left-0 w-full h-screen z-0 flex items-center justify-center pointer-events-none"
      >
        <div
          className="flex flex-col items-center justify-center px-8 sm:px-6 text-center w-full max-w-5xl"
          style={{ marginTop: "-5vh" }}
        >
          {/* Credential bar */}
          <div
            className="w-full max-w-xl md:max-w-3xl mb-5 md:mb-6 flex flex-col items-center pointer-events-auto"
            style={{ opacity: 0 }}
            ref={logoStripRef}
          >
            <span
              aria-hidden="true"
              style={{
                fontFamily:
                  "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "rgba(141, 168, 204, 0.58)",
                marginBottom: 14,
              }}
            >
              Builders from
              <span
                style={{
                  fontSize: "0.85em",
                  opacity: 0.72,
                  marginLeft: "0.35em",
                  letterSpacing: 0,
                  display: "inline-block",
                  transform: "translateY(-0.5px)",
                }}
              >
                ↗
              </span>
            </span>
            <ul className="sr-only">
              <li>Our students have shipped software at:</li>
              {HERO_LOGOS.map((l) => (
                <li key={l.text}>{l.title || l.text}</li>
              ))}
            </ul>
            <GlowLogoCarousel
              logos={HERO_LOGOS}
              speed={22}
              gap={60}
              logoHeight={21}
              hoverGlow="rgba(91, 139, 232, 0.22)"
              tooltipAccent="#8DA8CC"
              pauseOnHover
            />
          </div>

          {/* Glow divider */}
          <div
            ref={lineRef}
            style={{
              width: 80,
              height: 1,
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
              marginBottom: 28,
              transformOrigin: "center",
              transform: "scaleX(0)",
              opacity: 0,
            }}
          />

          <h1
            ref={h1Ref}
            className="font-heading"
            style={{
              opacity: 0,
              fontSize: "clamp(2.25rem, 7.5vw, 6rem)",
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.035em",
            }}
          >
            <SplitLine
              text="Where students ship"
              style={{ color: "rgba(241,255,255,0.55)" }}
            />
            <SplitLine
              text="real software."
              style={{ color: "#F1FFFF" }}
            />
          </h1>
        </div>
      </div>

      {/* ── Spacer ── */}
      <div style={{ height: "65vh" }} aria-hidden="true" />

      {/* ── Globe container ── */}
      <div
        ref={globeWrapRef}
        className="relative z-10 w-full overflow-visible"
        style={{ height: "100vh" }}
      >
        <div
          className="absolute inset-0 overflow-visible"
          style={{
            maskImage: "radial-gradient(circle at 50% 50%, black 35%, transparent 55%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 35%, transparent 55%)",
          }}
        >
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              width: "min(130vw, 1500px, 115vh)",
              height: "min(130vw, 1500px, 115vh)",
            }}
            onPointerDown={() => setHasInteracted(true)}
          >
            <GlobeVisualizer className="w-full h-full" />
          </div>
        </div>

        {/* Top-left text overlay */}
        <div
          ref={topLeftRef}
          className="absolute z-20 pointer-events-none max-w-[200px] md:max-w-[280px]"
          style={{
            top: "8%",
            left: "clamp(0px, 4vw - 20px, 4%)",
            opacity: 0,
          }}
        >
          <p className="text-lg md:text-xl lg:text-2xl font-semibold leading-snug text-white">
            Technology has no
            <br />
            borders. Neither
            <br />
            does impact.
          </p>
        </div>

        {/* Bottom-right text overlay */}
        <div
          ref={bottomRightRef}
          className="absolute z-20 pointer-events-none max-w-[220px] md:max-w-[300px]"
          style={{
            bottom: "8%",
            right: "clamp(0px, 4vw - 20px, 4%)",
            opacity: 0,
          }}
        >
          <p className="text-lg md:text-xl lg:text-2xl font-semibold leading-snug text-white text-right">
            Projects on
            <br />
            this map are driven by
            <br />
            purpose. Built by students.
          </p>
        </div>

        {/* Rotate prompt */}
        <div
          className="absolute left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none select-none transition-opacity duration-500"
          style={{ bottom: "12%", opacity: hasInteracted ? 0 : 1 }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#71717a"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-spin-slow"
          >
            <path d="M21 12a9 9 0 1 1-6.22-8.56" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
          <span className="text-xs font-semibold text-zinc-500">
            Drag to explore &middot; Hover nodes
          </span>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        ref={scrollIndicatorRef}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-30"
        style={{ opacity: 0 }}
      >
        <ScrollIndicator />
        <span className="text-xs font-light text-[#3a3a3f]">
          Scroll to explore
        </span>
      </div>
    </section>
  );
}

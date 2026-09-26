"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const quoteText =
  "We're not a consultancy. We're a collective of students who believe nonprofits deserve the same software as Fortune 500 companies — and we prove it, one project at a time.";

export default function NPOScrollReveal() {
  const sectionRef = useRef<HTMLElement>(null);

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

  const words = quoteText.split(" ");

  return (
    <section
      ref={sectionRef}
      data-navbar-theme="dark"
      style={{ minHeight: "300vh", position: "relative" }}
    >
      <div
        className="q-pin"
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F0F10",
          padding: "clamp(24px, 8vw, 120px)",
          position: "relative",
        }}
      >
        {/* Giant decorative open-quote */}
        <div
          style={{
            position: "absolute",
            top: "12%",
            left: "clamp(24px, 8vw, 120px)",
            fontFamily: "var(--font-heading), Georgia, serif",
            fontSize: "clamp(120px, 20vw, 300px)",
            fontWeight: 300,
            color: "rgba(0, 47, 167, 0.03)",
            lineHeight: 1,
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          &ldquo;
        </div>

        <p
          style={{
            fontFamily: "var(--font-heading), Georgia, serif",
            fontSize: "clamp(32px, 5vw, 72px)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
            color: "#F1FFFF",
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

        {/* Bottom-left attribution */}
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
          <div style={{ width: 24, height: 1, background: "#002FA7" }} />
          <span
            style={{
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 10,
              fontWeight: 400,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#002FA7",
            }}
          >
            The Tethos Manifesto
          </span>
        </div>
      </div>
    </section>
  );
}

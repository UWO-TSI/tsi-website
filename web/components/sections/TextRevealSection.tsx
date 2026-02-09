"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const REVEAL_TEXT =
  "Tethos empowers students to deliver pro bono technology solutions for nonprofits, building real-world skills, ethical leadership, and community impact through projects that drives positive social change globally.";

const COLOR_GREY = "#d9d9d9";
const COLOR_DARK = "#0F0F10";

export default function TextRevealSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const charsRef = useRef<HTMLSpanElement[]>([]);

  useEffect(() => {
    if (!sectionRef.current) return;

    const chars = charsRef.current.filter(
      (char): char is HTMLSpanElement => Boolean(char)
    );
    const totalChars = chars.length;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "+=160%",
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          const filledCount = Math.min(
            totalChars,
            Math.ceil(self.progress * totalChars)
          );

          for (let i = 0; i < totalChars; i++) {
            chars[i].style.color = i < filledCount ? COLOR_DARK : COLOR_GREY;
          }
        },
        onLeave: () => {
          chars.forEach((char) => {
            char.style.color = COLOR_DARK;
          });
        },
      });
    }, sectionRef);

    const refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 150);

    return () => {
      ctx.revert();
      clearTimeout(refreshTimer);
    };
  }, []);

  // Split every character, rendering spaces as plain text nodes for wrapping
  charsRef.current = [];
  const charElements = REVEAL_TEXT.split("").map((char, i) => {
    if (char === " ") {
      return (
        <span key={i} style={{ color: COLOR_GREY, transition: "color 0.15s ease" }}>
          {" "}
        </span>
      );
    }
    return (
      <span
        key={i}
        ref={(el) => {
          if (el) charsRef.current[i] = el;
        }}
        style={{ color: COLOR_GREY, transition: "color 0.15s ease" }}
      >
        {char}
      </span>
    );
  });

  return (
    <section
      ref={sectionRef}
      className="h-screen flex items-center px-10 md:px-20 lg:px-28 overflow-hidden"
      style={{ background: "#F5FAFF" }}
    >
      <p
        className="leading-[1.15] tracking-tight"
        style={{
          fontFamily: '"Test Sogne", sans-serif',
          fontSize: "64px",
          fontWeight: 400,
          maxWidth: "900px",
          wordBreak: "normal",
          overflowWrap: "break-word",
        }}
      >
        {charElements}
      </p>
    </section>
  );
}

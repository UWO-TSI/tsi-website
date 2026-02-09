"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const REVEAL_TEXT =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";

const COLOR_GREY = "#d9d9d9";
const COLOR_DARK = "#0F0F10";

export default function TextRevealSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const charsRef = useRef<HTMLSpanElement[]>([]);

  useEffect(() => {
    if (!sectionRef.current) return;

    const chars = charsRef.current;
    const totalChars = chars.length;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "+=200%",
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          const filledCount = Math.floor(self.progress * totalChars);

          for (let i = 0; i < totalChars; i++) {
            if (chars[i]) {
              chars[i].style.color =
                i < filledCount ? COLOR_DARK : COLOR_GREY;
            }
          }
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
  const charElements = REVEAL_TEXT.split("").map((char, i) => {
    if (char === " ") {
      // Return a ref'd span with a normal space — allows line break
      return (
        <span
          key={i}
          ref={(el) => {
            if (el) charsRef.current[i] = el;
          }}
          style={{ color: COLOR_GREY }}
        >
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
        style={{ color: COLOR_GREY }}
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

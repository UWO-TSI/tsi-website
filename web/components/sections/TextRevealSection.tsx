"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const REVEAL_TEXT =
  "Tethos empowers students to deliver pro bono technology solutions for nonprofits, building real-world skills, ethical leadership, and community impact through projects that drives positive social change globally.";

const COLOR_GREY = "#d9d9d9";
const COLOR_DARK = "#0F0F10";

const IMAGES = [
  { src: "/images/TeamPhoto.png", alt: "Team photo" },
  { src: "/images/flag_signing.png", alt: "Flag signing" },
  { src: "/images/team.png", alt: "Team working" },
];

export default function TextRevealSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const charsRef = useRef<HTMLSpanElement[]>([]);
  const imagesRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    if (!sectionRef.current) return;

    const chars = charsRef.current.filter(
      (char): char is HTMLSpanElement => Boolean(char)
    );
    const totalChars = chars.length;
    const images = imagesRef.current.filter(Boolean);

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "+=160%",
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          const progress = self.progress;

          // Text reveal
          const filledCount = Math.min(
            totalChars,
            Math.ceil(progress * totalChars)
          );
          for (let i = 0; i < totalChars; i++) {
            chars[i].style.color = i < filledCount ? COLOR_DARK : COLOR_GREY;
          }

          // Image reveal — stagger across the scroll progress
          images.forEach((img, idx) => {
            const imgStart = idx * 0.25; // each image starts 25% apart
            const imgEnd = imgStart + 0.3;
            const imgProgress = Math.min(
              1,
              Math.max(0, (progress - imgStart) / (imgEnd - imgStart))
            );
            img.style.opacity = String(imgProgress);
            img.style.transform = `translateY(${(1 - imgProgress) * 40}px)`;
          });
        },
        onLeave: () => {
          chars.forEach((char) => {
            char.style.color = COLOR_DARK;
          });
          images.forEach((img) => {
            img.style.opacity = "1";
            img.style.transform = "translateY(0px)";
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
      {/* Left: text — takes up ~55% of the width */}
      <div className="w-[55%] min-w-0 flex-shrink-0">
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
      </div>

      {/* Right: stacked images — fills remaining space */}
      <div className="hidden lg:flex relative flex-1 h-[700px]">
        {IMAGES.map((image, idx) => (
          <div
            key={idx}
            ref={(el) => {
              if (el) imagesRef.current[idx] = el;
            }}
            className="absolute overflow-hidden shadow-xl"
            style={{
              opacity: 0,
              transform: "translateY(40px)",
              top: `${idx * 220}px`,
              right: `${idx % 2 === 0 ? 0 : 30}px`,
              width: "600px",
              height: "300px",
              borderRadius: "15px",
              zIndex: idx + 1,
            }}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              className="object-cover"
              sizes="600px"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EASE_ENTER, DURATION_SECTION } from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface AsciiRevealProps {
  children: ReactNode;
  /** Text to scramble through before revealing */
  scrambleChars?: string;
  /** Duration of the scramble phase in seconds */
  scrambleDuration?: number;
  /** Trigger on scroll into view (true) or immediately (false) */
  triggerOnScroll?: boolean;
  /** Additional className for the wrapper */
  className?: string;
}

/**
 * Text reveal with ASCII glitch/scramble effect.
 * The text appears first as random ASCII characters,
 * then resolves to the actual content — brief, cinematic.
 */
export default function AsciiReveal({
  children,
  scrambleChars = "░▒▓█#@&%?!<>{}[]/*-+=~^",
  scrambleDuration = 0.8,
  triggerOnScroll = true,
  className = "",
}: AsciiRevealProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [revealed, setRevealed] = useState(!triggerOnScroll);
  const originalText = useRef<string>("");
  const hasRun = useRef(false);

  useEffect(() => {
    if (!textRef.current) return;
    originalText.current = textRef.current.textContent || "";
  }, [children]);

  useEffect(() => {
    if (!triggerOnScroll || !wrapperRef.current || hasRun.current) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: wrapperRef.current,
        start: "top 80%",
        onEnter: () => {
          if (hasRun.current) return;
          hasRun.current = true;
          runScramble();
        },
        once: true,
      });
    }, wrapperRef);

    return () => ctx.revert();
  }, [triggerOnScroll]);

  const runScramble = () => {
    if (!textRef.current) return;

    const text = originalText.current;
    const totalFrames = Math.ceil(scrambleDuration * 60); // ~60fps
    let frame = 0;

    // Start with the element visible but scrambled
    gsap.to(wrapperRef.current, {
      opacity: 1,
      duration: 0.15,
      ease: EASE_ENTER,
    });

    const interval = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;

      // Characters resolve left-to-right as progress increases
      let result = "";
      for (let i = 0; i < text.length; i++) {
        const charProgress = i / text.length;
        if (charProgress < progress - 0.1) {
          // Already resolved
          result += text[i];
        } else if (text[i] === " ") {
          result += " ";
        } else {
          // Still scrambling
          result +=
            scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
        }
      }

      textRef.current!.textContent = result;

      if (frame >= totalFrames) {
        clearInterval(interval);
        textRef.current!.textContent = text;
        setRevealed(true);
      }
    }, 1000 / 60);
  };

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{ opacity: triggerOnScroll ? 0 : 1 }}
    >
      <span ref={textRef}>{children}</span>
    </div>
  );
}

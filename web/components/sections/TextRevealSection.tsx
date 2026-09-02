"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import DecryptedText from "@/components/ui/DecryptedText";
import GradientText from "@/components/ui/GradientText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const IMAGES = [
  { src: "/images/TeamPhoto.webp", alt: "Team photo" },
  { src: "/images/flag_signing.webp", alt: "Flag signing" },
  { src: "/images/TeamPhoto.webp", alt: "Team working" },
];

export default function TextRevealSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        // Instant reveal, no animation
        gsap.set(lineRef.current, { scaleX: 1 });
        gsap.set(textRef.current, { opacity: 1, y: 0 });
        const imgs = imagesRef.current?.children;
        if (imgs) gsap.set(Array.from(imgs), { opacity: 1, clipPath: "inset(0 0 0 0)" });
        return;
      }

      // Accent line draws in
      gsap.fromTo(
        lineRef.current,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 1.2,
          ease: "power3.inOut",
          scrollTrigger: { trigger: sectionRef.current, start: "top 70%", once: true },
        }
      );

      // Text slides up
      gsap.fromTo(
        textRef.current,
        { opacity: 0, y: 60 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 65%", once: true },
        }
      );

      // Images: clip-path reveal (not fade-up)
      const imgs = imagesRef.current?.children;
      if (imgs) {
        gsap.fromTo(
          Array.from(imgs),
          { clipPath: "inset(100% 0 0 0)", opacity: 1 },
          {
            clipPath: "inset(0% 0 0 0)",
            duration: 1,
            ease: "power4.inOut",
            stagger: 0.18,
            scrollTrigger: { trigger: imagesRef.current, start: "top 75%", once: true },
          }
        );
      }

      // Parallax: each image moves at a different rate on scroll
      const imgElements = imagesRef.current?.children;
      if (imgElements) {
        Array.from(imgElements).forEach((img, i) => {
          const speed = [0.15, 0.25, 0.1][i] || 0.15;
          gsap.to(img, {
            yPercent: -speed * 100,
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          });
        });
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="about"
      ref={sectionRef}
      data-navbar-theme="dark"
      className="relative py-32 md:py-44 px-8 md:px-20 lg:px-28 overflow-hidden"
      style={{ background: "#0a0a0b" }}
    >
      {/* Top gradient blend from hero */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: "200px",
          background: "linear-gradient(to bottom, #0F0F10, #0a0a0b)",
        }}
      />


      <div className="relative max-w-[1400px] mx-auto flex flex-col lg:flex-row items-start gap-16 lg:gap-24">
        {/* Left: mission text */}
        <div ref={textRef} className="w-full lg:w-[50%] flex-shrink-0" style={{ opacity: 0 }}>
          <p
            className="text-sm font-medium tracking-widest uppercase mb-6"
            style={{ color: "#1d9bf0", fontFamily: "var(--font-highlight)" }}
          >
            <DecryptedText text="What we do" speed={40} maxIterations={12} sequential characters="01!@#$%_-+=<>" className="text-[#1d9bf0]" encryptedClassName="text-[rgba(29,155,240,0.3)]" animateOn="view" />
          </p>

          {/* Accent line */}
          <div
            ref={lineRef}
            className="mb-8 origin-left"
            style={{
              width: "60px",
              height: "2px",
              background: "linear-gradient(90deg, #1d9bf0, transparent)",
              transform: "scaleX(0)",
            }}
          />

          <h2
            className="leading-[1.08] tracking-tight mb-8"
            style={{
              fontFamily: '"Test Sohne", sans-serif',
              fontSize: "clamp(32px, 4.5vw, 56px)",
              fontWeight: 500,
              color: "#F1FFFF",
            }}
          >
            Pro bono software for
            <br />
            organizations that{" "}
            <GradientText colors={["#1d9bf0", "#60c5ff", "#1d9bf0"]} animationSpeed={6}>
              matter.
            </GradientText>
          </h2>
          <p
            className="leading-relaxed text-lg md:text-xl"
            style={{
              color: "rgba(255,255,255,0.5)",
              fontFamily: '"Test Sohne", sans-serif',
              maxWidth: "520px",
            }}
          >
            Tethos empowers students to deliver production-grade technology
            solutions for nonprofits, building real-world skills and driving
            positive social change globally.
          </p>
        </div>

        {/* Right: image grid with clip-path reveals + parallax */}
        <div ref={imagesRef} className="w-full lg:flex-1 grid grid-cols-2 gap-3">
          <div
            className="col-span-2 relative overflow-hidden rounded-xl"
            style={{ height: "clamp(220px, 30vh, 320px)", clipPath: "inset(100% 0 0 0)" }}
          >
            <Image
              src={IMAGES[0].src}
              alt={IMAGES[0].alt}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(to top, rgba(10,10,11,0.4), transparent)" }}
            />
          </div>
          {IMAGES.slice(1).map((image, idx) => (
            <div
              key={idx}
              className="relative overflow-hidden rounded-xl"
              style={{ height: "clamp(160px, 22vh, 240px)", clipPath: "inset(100% 0 0 0)" }}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 50vw, 25vw"
              />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(to top, rgba(10,10,11,0.3), transparent)" }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

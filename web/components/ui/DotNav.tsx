"use client";

import { useEffect, useRef, useState } from "react";

export interface DotNavSection {
  id: string;
  label: string;
}

interface DotNavProps {
  sections: DotNavSection[];
}

export default function DotNav({ sections }: DotNavProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  /* Track which section is in view */
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    sections.forEach((section, index) => {
      const el = document.getElementById(section.id);
      if (!el) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveIndex(index);
            }
          });
        },
        { threshold: 0.3, rootMargin: "-10% 0px -10% 0px" }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [sections]);

  /* Show dots after scrolling past the first viewport */
  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.5);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <nav
      ref={navRef}
      aria-label="Page sections"
      className="fixed right-6 top-1/2 z-50 -translate-y-1/2 transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}
    >
      <ul className="flex flex-col items-end gap-5">
        {sections.map((section, i) => {
          const isActive = activeIndex === i;
          const isHovered = hoveredIndex === i;

          return (
            <li key={section.id} className="relative flex items-center">
              {/* Label tooltip */}
              <span
                className="absolute right-8 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium tracking-wide transition-all duration-300"
                style={{
                  opacity: isHovered ? 1 : 0,
                  transform: isHovered ? "translateX(0)" : "translateX(8px)",
                  background: "rgba(15, 15, 16, 0.85)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: isActive ? "#fff" : "rgba(255, 255, 255, 0.7)",
                  pointerEvents: "none",
                  fontFamily: "var(--font-highlight)",
                }}
              >
                {section.label}
              </span>

              {/* Dot */}
              <button
                type="button"
                onClick={() => scrollTo(section.id)}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                aria-label={`Scroll to ${section.label}`}
                aria-current={isActive ? "true" : undefined}
                className="group relative flex items-center justify-center"
                style={{ width: 20, height: 20 }}
              >
                {/* Outer ring on active */}
                <span
                  className="absolute rounded-full transition-all duration-300"
                  style={{
                    width: isActive ? 16 : 0,
                    height: isActive ? 16 : 0,
                    border: isActive ? "1.5px solid rgba(255, 255, 255, 0.3)" : "1.5px solid transparent",
                    opacity: isActive ? 1 : 0,
                  }}
                />
                {/* Inner dot */}
                <span
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: isActive ? 6 : isHovered ? 8 : 5,
                    height: isActive ? 6 : isHovered ? 8 : 5,
                    background: isActive
                      ? "#fff"
                      : isHovered
                        ? "rgba(255, 255, 255, 0.7)"
                        : "rgba(255, 255, 255, 0.3)",
                  }}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

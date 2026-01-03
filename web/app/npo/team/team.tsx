"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(Draggable, ScrollTrigger);
}

const teamPhotos = [
  {
    year: "2024",
    title: "Brand & Marketing",
    description:
      "Campaign leads, storytellers, and designers shaping our brand voice and outreach.",
  },
  {
    year: "2023",
    title: "Partnerships & External",
    description: "Allies building alliances with nonprofits, sponsors, and universities.",
  },
  {
    year: "2022",
    title: "Product & Delivery",
    description: "PMs and engineers shipping features and keeping releases on track.",
  },
  {
    year: "2021",
    title: "Operations & Finance",
    description: "People, finance, and ops specialists keeping the engine running smoothly.",
  },
  {
    year: "2020",
    title: "Data & Insights",
    description: "Analysts and researchers turning program outcomes into decisions and impact reports.",
  },
  {
    year: "2019",
    title: "Volunteer Experience",
    description: "Coordinators designing onboarding, training, and recognition for our volunteers.",
  },
  {
    year: "2018",
    title: "Student Success",
    description: "Mentors and coaches supporting learners with pathways, feedback, and community.",
  },
];

export default function Team() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const draggableRef = useRef<Draggable | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Fade in from top
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top bottom",
        end: "top center",
        scrub: 1,
        onUpdate: (self) => {
          gsap.to(contentRef.current, {
            opacity: self.progress,
            duration: 0,
            ease: "none",
          });
        },
      });

      // Fade out to bottom
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "bottom center",
        end: "bottom top",
        scrub: 1,
        onUpdate: (self) => {
          gsap.to(contentRef.current, {
            opacity: 1 - self.progress,
            duration: 0,
            ease: "none",
          });
        },
      });
    }, sectionRef);

    return () => {
      ctx.revert();
    };
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    const container = containerRef.current;
    if (!track || !container) return;

    const createDrag = () => {
      const totalCards = teamPhotos.length;
      const gap = parseFloat(getComputedStyle(track).gap || "0") || 0;
      const firstSlide = track.children[0] as HTMLElement | undefined;
      const cardWidth = firstSlide?.getBoundingClientRect().width || container.offsetWidth;
      const slideSize = cardWidth + gap;
      const maxX = 0;
      const totalWidth = slideSize * totalCards - gap; // last gap not needed visually
      const minX = Math.min(0, container.offsetWidth - totalWidth);

      // Kill old instance before creating a new one
      draggableRef.current?.kill();

      const instance = Draggable.create(track, {
        type: "x",
        bounds: { minX, maxX },
        inertia: true,
        dragResistance: 0.04,
        edgeResistance: 0.18,
        // No snap: allow free, smooth drag with inertia
        onDrag() {
          const index = Math.round(-this.x / slideSize);
          setCurrentIndex(Math.max(0, Math.min(totalCards - 1, index)));
        },
        onThrowComplete() {
          const index = Math.round(-this.x / slideSize);
          setCurrentIndex(Math.max(0, Math.min(totalCards - 1, index)));
        },
      })[0];

      draggableRef.current = instance;
    };

    createDrag();

    const handleResize = () => {
      createDrag();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      draggableRef.current?.kill();
    };
  }, []);

  const goToSlide = (index: number) => {
    const track = trackRef.current;
    const container = containerRef.current;
    if (!track || !container) return;

    const cardWidth = container.offsetWidth;
    gsap.to(track, {
      x: -index * cardWidth,
      duration: 0.5,
      ease: "power2.out",
    });
    setCurrentIndex(index);
  };

  return (
    <section
      ref={sectionRef}
      className="relative pt-2 pb-5 w-screen h-screen flex flex-col"
      style={{ backgroundColor: "#0F0F10" }}
    >
      <div ref={contentRef} className="flex flex-col h-full">

        {/* Draggable Cards Container */}
        <div
          ref={containerRef}
          className="flex-1 p-10 relative overflow-hidden cursor-grab active:cursor-grabbing select-none"
        >
          <div
            ref={trackRef}
            className="flex h-full items-center gap-6"
            style={{ touchAction: "pan-y" }}
          >
            {teamPhotos.map((photo, index) => (
              <div
                key={index}
                className="flex-shrink-0 h-full py-8 flex flex-col"
                style={{ width: "88vw", maxWidth: "1080px" }}
              >
                {/* Rectangle acting as PNG placeholder */}
                <div className="relative flex-1 mx-auto max-w-6xl w-full">
                  <div
                    className="w-full h-full rounded-2xl shadow-lg"
                    style={{
                      backgroundColor: "#0D1B2A",
                      minHeight: "60vh",
                      border: "1px solid #111113",
                    }}
                  >
                    <div className="absolute inset-0 rounded-2xl" style={{ border: "1px solid #111113" }} />
                    <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-2 bg-[#111113]/85 backdrop-blur-sm rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="font-semibold"
                          style={{
                            fontSize: "32px",
                            lineHeight: "1.1",
                            color: "#FFD186",
                            fontFamily:
                              'Space Grotesk, var(--font-body), system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                          }}
                        >
                          {photo.year}
                        </span>
                        <h3
                          className="font-medium"
                          style={{
                            fontSize: "26px",
                            lineHeight: "1.2",
                            color: "#FFFFFF",
                            fontFamily:
                              'Space Grotesk, var(--font-body), system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                          }}
                        >
                          {photo.title}
                        </h3>
                      </div>
                      <p
                        className="text-lg leading-relaxed"
                        style={{
                          color: "#E4E4E7",
                          fontFamily:
                            'Space Grotesk, var(--font-body), system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                        }}
                      >
                        {photo.description}
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

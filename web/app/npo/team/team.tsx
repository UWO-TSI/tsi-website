"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";

if (typeof window !== "undefined") {
  gsap.registerPlugin(Draggable);
}

const teamPhotos = [
  {
    year: "2024",
    title: "Annual Conference",
    description: "Our dedicated team gathered at the 2024 annual conference to celebrate achievements and plan for the future.",
  },
  {
    year: "2023",
    title: "Community Outreach",
    description: "Team members engaging with local communities to expand our programs and connect with students.",
  },
  {
    year: "2022",
    title: "Program Launch",
    description: "The founding team celebrating the successful launch of our mentorship program.",
  },
  {
    year: "2021",
    title: "Virtual Summit",
    description: "Adapting to new challenges, our team connected virtually to continue our mission.",
  },
];

export default function Team() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    const container = containerRef.current;
    if (!track || !container) return;

    const cardWidth = container.offsetWidth;
    const totalCards = teamPhotos.length;
    const maxX = 0;
    const minX = -(cardWidth * (totalCards - 1));

    const draggable = Draggable.create(track, {
      type: "x",
      bounds: { minX, maxX },
      inertia: true,
      snap: (endValue) => {
        const index = Math.round(-endValue / cardWidth);
        setCurrentIndex(index);
        return -index * cardWidth;
      },
      onDrag() {
        const index = Math.round(-this.x / cardWidth);
        setCurrentIndex(index);
      },
    });

    return () => {
      draggable[0].kill();
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
    <section className="relative h-screen flex flex-col" style={{ backgroundColor: '#0F0F10' }}>
      {/* Title */}
      <div className="p-12 md:p-16">
        <h1 
          className="font-semibold"
          style={{ 
            fontSize: '48px',
            lineHeight: '1.1',
            color: '#FFFFFF'
          }}
        >
          Meet Our Team
        </h1>
      </div>

      {/* Draggable Cards Container */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing">
        <div ref={trackRef} className="flex h-full items-center">
          {teamPhotos.map((photo, index) => (
            <div
              key={index}
              className="flex-shrink-0 h-full px-8 py-8 flex flex-col"
              style={{ width: '100vw' }}
            >
              {/* Photo Container */}
              <div className="relative flex-1 mx-auto max-w-6xl w-full">
                {/* Pink Rectangle Placeholder for Team Photo */}
                <div 
                  className="w-full h-full rounded-2xl"
                  style={{ 
                    backgroundColor: '#EC4899'
                  }}
                />
              </div>

              {/* Description Block */}
              <div className="mt-6 mx-auto max-w-6xl w-full px-4">
                <div 
                  className="rounded-xl p-6"
                  style={{ backgroundColor: '#111113' }}
                >
                  <div className="flex items-baseline gap-4 mb-2">
                    <span 
                      className="font-semibold"
                      style={{ 
                        fontSize: '36px',
                        lineHeight: '1.2',
                        color: '#FFD186'
                      }}
                    >
                      {photo.year}
                    </span>
                    <h3 
                      className="font-medium"
                      style={{ 
                        fontSize: '28px',
                        lineHeight: '1.3',
                        color: '#FFFFFF'
                      }}
                    >
                      {photo.title}
                    </h3>
                  </div>
                  <p 
                    className="text-lg leading-relaxed"
                    style={{ color: '#A1A1AA' }}
                  >
                    {photo.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Dots */}
      <div className="p-8 flex justify-center gap-3">
        {teamPhotos.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className="p-4 transition-all"
            aria-label={`Go to team photo ${index + 1}`}
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: currentIndex === index ? '#FFD186' : '#52525B'
              }}
            />
          </button>
        ))}
      </div>
    </section>
  );
}

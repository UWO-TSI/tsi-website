"use client";

import { useState } from "react";
import { CardCarouselLayout } from "./CardCarouselLayout";
import type { PathwayCard } from "./types";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface CardCarouselProps {
  cards: PathwayCard[];
}

export function CardCarousel({ cards }: CardCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const total = cards.length;

  const slide = (delta: number) => {
    if (isAnimating) return;

    setIsAnimating(true);
    setActiveIndex((i) => (i + delta + total) % total);

    // Allow animations to complete
    setTimeout(() => {
      setIsAnimating(false);
    }, 600);
  };

  return (
    <div className="relative">
      <CardCarouselLayout cards={cards} activeIndex={activeIndex} />

      <div className="absolute inset-x-0 top-1/2 flex justify-between px-8 pointer-events-none">
        <button
          onClick={() => slide(-1)}
          className="pointer-events-auto"
          aria-label="Previous"
          disabled={isAnimating}
        >
          <ChevronLeftIcon className="h-6 w-6 text-white" />
        </button>

        <button
          onClick={() => slide(1)}
          className="pointer-events-auto"
          aria-label="Next"
          disabled={isAnimating}
        >
          <ChevronRightIcon className="h-6 w-6 text-white" />
        </button>
      </div>
    </div>
  );
}
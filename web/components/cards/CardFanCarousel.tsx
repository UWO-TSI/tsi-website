"use client";

import { useState } from "react";
import { CardFan } from "./CardFan";
import type { PathwayCard } from "./types";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface CardFanCarouselProps {
  cards: PathwayCard[];
  visibleCount?: number;
}

export function CardFanCarousel({
  cards,
  visibleCount = 3,
}: CardFanCarouselProps) {
  const [startIndex, setStartIndex] = useState(0);

  const total = cards.length;

  if (total <= visibleCount) {
    return <CardFan cards={cards} />;
  }

  const next = () => {
    setStartIndex((prev) => (prev + 1) % total);
  };

  const prev = () => {
    setStartIndex((prev) => (prev - 1 + total) % total);
  };

  const visibleCards = Array.from({ length: visibleCount }, (_, i) => {
    return cards[(startIndex + i) % total];
  });

  return (
    <div className="relative w-full">
      {/* Card fan area */}
      <div className="relative h-[560px] w-full">
        <CardFan cards={visibleCards} />
      </div>

      {/* Carousel controls (positioned relative to cards, not page) */}
      <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-6">
        <button
          onClick={prev}
          className="pointer-events-auto rounded-full p-2 text-zinc-400 hover:text-white hover:bg-white/5 transition"
          aria-label="Previous"
        >
          <ChevronLeftIcon className="h-6 w-6" />
        </button>

        <button
          onClick={next}
          className="pointer-events-auto rounded-full p-2 text-zinc-400 hover:text-white hover:bg-white/5 transition"
          aria-label="Next"
        >
          <ChevronRightIcon className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
"use client";

import { useMemo, useState } from "react";
import { CardFan } from "./CardFan";
import type { PathwayCard } from "./types";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface CardFanCarouselProps {
  cards: PathwayCard[];
  visibleCount?: number;
  offsetX?: number;
  cardWidth?: number;
  cardSpacing?: number;
}

export function CardFanCarousel({
  cards,
  visibleCount = 3,
  offsetX = 0,
  cardWidth = 330,
  cardSpacing = 0.75,
}: CardFanCarouselProps) {
  const [startIndex, setStartIndex] = useState(0);

  const total = cards.length;
  const count = Math.min(visibleCount, total);

  // Windowed slice with wrap‑around (infinite loop)
  const visibleCards = useMemo(() => {
    if (total === 0 || count === 0) return [];

    return Array.from({ length: count }, (_, i) => {
      const carouselIndex = (startIndex + i + total) % total;
      return {
        card: cards[carouselIndex],
        carouselIndex,
        displayIndex: i,
      };
    });
  }, [cards, count, startIndex, total]);

  const fanWidth = useMemo(() => {
    if (count <= 1) return cardWidth;
    return cardWidth + (count - 1) * cardWidth * cardSpacing;
  }, [cardWidth, cardSpacing, count]);

  // Infinite navigation
  const next = () => {
    if (total === 0) return;
    setStartIndex((prev) => (prev + 1) % total);
  };

  const prev = () => {
    if (total === 0) return;
    setStartIndex((prev) => (prev - 1 + total) % total);
  };

  return (
    <div className="relative w-full overflow-visible flex items-center justify-center">
      <div
        className="relative overflow-visible"
        style={{
          width: `${fanWidth}px`,
          transform: `translateX(${offsetX}px)`,
        }}
      >
        <CardFan cardData={visibleCards} />

        <div className="pointer-events-none absolute inset-y-0 left-0 z-[60] w-full flex items-center">
          <div className="flex w-full justify-between">
            <button
              type="button"
              onClick={prev}
              className="pointer-events-auto rounded-full p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
              aria-label="Previous"
            >
              <ChevronLeftIcon className="h-6 w-6" />
            </button>

            <button
              type="button"
              onClick={next}
              className="pointer-events-auto rounded-full p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
              aria-label="Next"
            >
              <ChevronRightIcon className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
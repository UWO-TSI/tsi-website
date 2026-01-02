"use client";

import { useMemo, useState } from "react";
import { CardFan } from "./CardFan";
import type { PathwayCard } from "./types";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface Props {
  cards: PathwayCard[];
  visibleCount?: number;
  controlsOffsetY?: string;
}

export function CardFanCarousel({
  cards,
  visibleCount = 3,
  controlsOffsetY = "translate-y-12",
}: Props) {
  const [startIndex, setStartIndex] = useState(0);

  const total = cards.length;
  const count = Math.min(visibleCount, total);

  const visibleCards = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const idx = (startIndex + i + total) % total;
      return {
        card: cards[idx],
        displayIndex: i,
      };
    });
  }, [cards, count, startIndex, total]);

  const next = () => setStartIndex((i) => (i + 1) % total);
  const prev = () => setStartIndex((i) => (i - 1 + total) % total);

  return (
    <div className="relative pointer-events-auto">
      <CardFan cardData={visibleCards} />

      {/* Carousel controls (positioned by parent) */}
      <div
        className={`absolute left-0 right-0 top-1/2 ${controlsOffsetY} flex items-center justify-between px-8 pointer-events-none`}
      >
        <button
          onClick={prev}
          className="pointer-events-auto rounded-full p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
          aria-label="Previous"
        >
          <ChevronLeftIcon className="h-6 w-6" />
        </button>

        <button
          onClick={next}
          className="pointer-events-auto rounded-full p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
          aria-label="Next"
        >
          <ChevronRightIcon className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
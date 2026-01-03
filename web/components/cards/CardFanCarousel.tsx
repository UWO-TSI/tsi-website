"use client";

import { useState, useRef } from "react";
import { CardFan } from "./CardFan";
import type { PathwayCard } from "./types";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

interface Props {
  cards: PathwayCard[];
}

export function CardFanCarousel({ cards }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const prevIndex = useRef(activeIndex);

  const total = cards.length;

  const move = (delta: number) => {
    prevIndex.current = activeIndex;
    setActiveIndex((i) => (i + delta + total) % total);
  };

  return (
    <div className="relative">
      <CardFan
        cards={cards}
        activeIndex={activeIndex}
        prevIndex={prevIndex.current}
      />

      <div className="absolute inset-x-0 top-1/2 flex justify-between px-8 pointer-events-none">
        <button
          onClick={() => move(-1)}
          className="pointer-events-auto"
          aria-label="Previous"
        >
          <ChevronLeftIcon className="h-6 w-6 text-white" />
        </button>

        <button
          onClick={() => move(1)}
          className="pointer-events-auto"
          aria-label="Next"
        >
          <ChevronRightIcon className="h-6 w-6 text-white" />
        </button>
      </div>
    </div>
  );
}

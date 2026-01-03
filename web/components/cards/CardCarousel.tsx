"use client";

import { useState } from "react";
import { CardCarouselLayout } from "./CardCarouselLayout";
import type { PathwayCard } from "./types";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface CardCarouselProps {
  cards: PathwayCard[];
  renderControls?: (props: {
    onPrev: () => void;
    onNext: () => void;
    isAnimating: boolean;
  }) => React.ReactNode;
}

export function CardCarousel({ cards, renderControls }: CardCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const total = cards.length;

  const slide = (delta: number) => {
    if (isAnimating) return;

    setIsAnimating(true);
    setActiveIndex((i) => (i + delta + total) % total);

    setTimeout(() => setIsAnimating(false), 600);
  };

  return (
    <div className="relative">
      {/* Cards */}
      <div className="relative" style={{ transform: "translateX(35px)" }}>
        <CardCarouselLayout cards={cards} activeIndex={activeIndex} />
      </div>

      {/* Controls (layout delegated) */}
      {renderControls?.({
        onPrev: () => slide(-1),
        onNext: () => slide(1),
        isAnimating,
      })}
    </div>
  );
}

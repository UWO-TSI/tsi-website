"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import PositionedCard from "./PositionedCard";
import type { PathwayCard } from "./types";

interface CardCarouselLayoutProps {
  cards: PathwayCard[];
  activeIndex: number;
}

export function CardCarouselLayout({
  cards,
  activeIndex,
}: CardCarouselLayoutProps) {
  const [prevActiveIndex, setPrevActiveIndex] = useState(activeIndex);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const total = cards.length;

  useEffect(() => {
    if (activeIndex !== prevActiveIndex) {
      // Determine direction
      let diff = activeIndex - prevActiveIndex;

      // Handle wrap-around
      if (diff > total / 2) diff -= total;
      if (diff < -total / 2) diff += total;

      setDirection(diff > 0 ? "right" : "left");
      setPrevActiveIndex(activeIndex);
    }
  }, [activeIndex, prevActiveIndex, total]);

  return (
    <div className="relative w-full flex justify-center pointer-events-none">
      <div className="relative">
        <AnimatePresence mode="popLayout">
          {cards.map((card, i) => {
            let offset = i - activeIndex;

            // loop
            if (offset > total / 2) offset -= total;
            if (offset < -total / 2) offset += total;

            // show only 3 cards
            if (Math.abs(offset) > 1) return null;

            // Determine if this card is entering the visible area
            const prevOffset = i - prevActiveIndex;
            const wasVisible = Math.abs(prevOffset) <= 1;
            const isEntering = !wasVisible;

            return (
              <PositionedCard
                key={`${card.title}-${i}`}
                card={card}
                index={offset as -1 | 0 | 1}
                isEntering={isEntering}
                direction={direction}
              />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
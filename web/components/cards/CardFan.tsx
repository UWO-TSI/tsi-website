"use client";

import { AnimatePresence } from "framer-motion";
import Card3D from "./Card3D";
import type { PathwayCard } from "./types";

interface Props {
  cards: PathwayCard[];
  activeIndex: number;
  direction: "left" | "right";
}

export function CardFan({ cards, activeIndex, direction }: Props) {
  const total = cards.length;

  const visible = [
    { card: cards[(activeIndex - 1 + total) % total], position: -1 },
    { card: cards[activeIndex], position: 0 },
    { card: cards[(activeIndex + 1) % total], position: 1 },
  ] as const;

  return (
    <div className="relative w-full flex justify-center pointer-events-none">
      <div className="relative">
        <AnimatePresence initial={false}>
          {visible.map(({ card, position }) => (
            <Card3D
              key={`${card.title}-${position}`}
              card={card}
              position={position}
              direction={direction}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

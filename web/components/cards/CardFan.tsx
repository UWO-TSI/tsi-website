"use client";

import Card3D from "./Card3D";
import type { PathwayCard } from "./types";

interface Props {
  cards: PathwayCard[];
  activeIndex: number;
  direction: 1 | -1;
}

export function CardFan({ cards, activeIndex, direction }: Props) {
  const total = cards.length;

  return (
    <div className="relative w-full flex justify-center pointer-events-none">
      <div className="relative">
        {cards.map((card, i) => {
          let offset = i - activeIndex;

          // preserve continuity (prevents teleporting)
          if (offset > total / 2) offset -= total;
          if (offset < -total / 2) offset += total;

          return (
            <Card3D
              key={card.title}
              card={card}
              index={offset}
              totalCards={total}
              direction={direction}
            />
          );
        })}
      </div>
    </div>
  );
}

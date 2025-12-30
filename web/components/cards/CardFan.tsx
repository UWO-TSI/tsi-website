"use client";

import type { PathwayCard } from "./types";
import Card3D from "./Card3D";

export function CardFan({
  cards,
  bottomOffset = 0,
}: {
  cards: PathwayCard[];
  bottomOffset?: number;
}) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 w-full max-w-7xl"
      style={{ bottom: bottomOffset }}
    >
      <div className="relative h-[600px]">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-end justify-center">
          {cards.map((card, i) => (
            <Card3D
              key={card.title}
              card={card}
              index={i}
              totalCards={cards.length}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
"use client";

import { Card3D } from "./Card3D";
import type { PathwayCard } from "./types";

const CARD_BOTTOM_OFFSET = -175;

export function CardFan({ cards }: { cards: PathwayCard[] }) {
  return (
    <div className="hidden md:block relative w-full h-full">
      <div
        className="absolute left-1/2 -translate-x-1/2 flex items-end justify-center"
        style={{
          bottom: CARD_BOTTOM_OFFSET,
        }}
      >
        {cards.map((card, index) => (
          <Card3D
            key={card.title}
            card={card}
            index={index}
            totalCards={cards.length}
          />
        ))}
      </div>
    </div>
  );
}
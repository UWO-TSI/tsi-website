"use client";

import Card3D from "./Card3D";
import type { PathwayCard } from "./types";

interface FanItem {
  card: PathwayCard;
  displayIndex: number;
}

interface CardFanProps {
  cardData: FanItem[];
}

export function CardFan({ cardData }: CardFanProps) {
  return (
    <div className="pointer-events-none flex w-full justify-center">
      <div className="relative">
        {cardData.map(({ card, displayIndex }) => (
          <Card3D
            key={`${card.title}-${displayIndex}`}
            card={card}
            index={displayIndex}
            totalCards={cardData.length}
          />
        ))}
      </div>
    </div>
  );
}
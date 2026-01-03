"use client";

import Card3D from "./Card3D";

interface Props {
  cards: PathwayCard[];
  activeIndex: number;
  prevIndex: number;
}

export function CardFan({ cards, activeIndex, prevIndex }: Props) {
  const total = cards.length;

  // derived direction: -1 = left, +1 = right
  const direction =
    (activeIndex - prevIndex + total) % total === 1 ? -1 : 1;

  return (
    <div className="relative w-full flex justify-center pointer-events-none">
      <div className="relative">
        {cards.map((card, i) => {
          let offset = i - activeIndex;

          if (offset > total / 2) offset -= total;
          if (offset < -total / 2) offset += total;

          return (
            <Card3D
              key={`${card.title}-${offset}`}
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

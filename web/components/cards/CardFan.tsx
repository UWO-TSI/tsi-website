import Card3D from "./Card3D";
import type { PathwayCard } from "./types";

interface Props {
  cards: PathwayCard[];
}

export function CardFan({ cards }: Props) {
  return (
    <div className="relative w-full h-full overflow-visible">
      {/* Anchor point — parent sections control where this sits */}
      <div className="absolute inset-x-0 bottom-0 flex justify-center">
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
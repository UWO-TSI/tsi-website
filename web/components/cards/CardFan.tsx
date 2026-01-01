import Card3D from "./Card3D";
import type { PathwayCard } from "./types";

interface Props {
  cards: PathwayCard[];
}

export function CardFan({ cards }: Props) {
  return (
    <div className="relative">
      {cards.map((card, index) => (
        <Card3D
          key={card.title}
          card={card}
          index={index}
          totalCards={cards.length}
        />
      ))}
    </div>
  );
}
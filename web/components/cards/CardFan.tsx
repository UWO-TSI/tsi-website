import Card3D from "./Card3D";
import type { PathwayCard } from "./types";

interface CardData {
  card: PathwayCard;
  carouselIndex: number;
  displayIndex: number;
}

interface Props {
  cardData: CardData[];
}

export function CardFan({ cardData }: Props) {
  if (!cardData || cardData.length === 0) return null;

  return (
    <div className="relative w-full min-h-[570px]">
      {cardData.map(({ card, carouselIndex, displayIndex }) => (
        <Card3D
          key={`card-${carouselIndex}`}
          card={card}
          index={displayIndex}
          totalCards={cardData.length}
        />
      ))}
    </div>
  );
}
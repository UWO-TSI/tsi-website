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
    <div className="relative" style={{ width: '100%', minHeight: '570px' }}>
      {cardData.map(({ card, carouselIndex, displayIndex }) => {
        const key = `card-${carouselIndex}`;
        return (
          <Card3D
            key={key}
            card={card}
            index={displayIndex}
            totalCards={cardData.length}
          />
        );
      })}
    </div>
  );
}
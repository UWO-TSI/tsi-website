"use client";

import { motion } from "framer-motion";
import { getCardTransform, CARD_WIDTH, CARD_HEIGHT } from "./cardMath";
import type { PathwayCard } from "./types";
import { useRouter } from "next/navigation";
import Interactive3DCard from "./Interactive3DCard";

interface PositionedCardProps {
  card: PathwayCard;
  index: -1 | 0 | 1;
  isEntering: boolean;
  direction: "left" | "right" | null;
}

export default function PositionedCard({
  card,
  index,
  isEntering,
  direction,
}: PositionedCardProps) {
  const router = useRouter();
  const { xOffset, yOffset, rotation } = getCardTransform(index, 3);

  // Calculate starting position for entering cards
  const getInitialPosition = () => {
    if (!isEntering || !direction) {
      return { x: xOffset - CARD_WIDTH / 2, y: yOffset, rotate: rotation, opacity: 1 };
    }

    // Card slides in from the direction of movement
    const startMultiplier = direction === "right" ? 1.5 : -1.5;
    const farTransform = getCardTransform(startMultiplier, 3);
    
    return {
      x: farTransform.xOffset - CARD_WIDTH / 2,
      y: farTransform.yOffset,
      rotate: farTransform.rotation,
      opacity: 0,
    };
  };

  return (
    <motion.div
      className="absolute"
      initial={getInitialPosition()}
      animate={{
        x: xOffset - CARD_WIDTH / 2,
        y: yOffset,
        rotate: rotation,
        opacity: 1,
      }}
      transition={{
        x: { type: "spring", stiffness: 140, damping: 26 },
        y: { type: "spring", stiffness: 140, damping: 26 },
        rotate: { type: "spring", stiffness: 160, damping: 24 },
        opacity: { duration: isEntering ? 0.4 : 0.2 },
      }}
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        left: "50%",
        transformOrigin: "center bottom",
        zIndex: 10 - Math.abs(index),
      }}
    >

      <Interactive3DCard
        title={card.title}
        description={card.description}
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        onClick={() => card.href && router.push(card.href)}
      />
    </motion.div>
  );
}
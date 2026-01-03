"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import { getCardTransform, CARD_WIDTH, CARD_HEIGHT } from "./cardMath";
import type { PathwayCard } from "./types";
import { useRouter } from "next/navigation";

interface Props {
  card: PathwayCard;
  index: number;
  totalCards: number;
  direction: 1 | -1;
}

export default function Card3D({
  card,
  index,
  totalCards,
  direction,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { xOffset, yOffset, rotation } =
    getCardTransform(index, totalCards);

  // only fade cards that are truly entering / exiting
  const shouldFade = Math.abs(index) > totalCards / 2 - 1;

  return (
    <motion.div
      ref={ref}
      className="absolute"
      initial={{
        x: xOffset + direction * CARD_WIDTH,
        opacity: shouldFade ? 0 : 1,
      }}
      animate={{
        x: xOffset - CARD_WIDTH / 2,
        y: yOffset,
        rotate: rotation,
        opacity: 1,
      }}
      exit={{
        x: xOffset - direction * CARD_WIDTH,
        opacity: shouldFade ? 0 : 1,
      }}
      transition={{
        x: { type: "spring", stiffness: 260, damping: 30 },
        rotate: { type: "spring", stiffness: 300, damping: 25 },
        opacity: { duration: 0.15, ease: "easeOut" },
      }}
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        left: "50%",
        transformOrigin: "center bottom",
        zIndex: 20 - Math.abs(index),
        pointerEvents: "auto",
      }}
      onClick={() => card.href && router.push(card.href)}
    >
      <div className="glass-card w-full h-full p-8 rounded-2xl flex flex-col justify-center">
        <h3 className="text-2xl font-semibold mb-3">
          {card.title}
        </h3>
        <p className="text-zinc-400 text-sm">
          {card.description}
        </p>
      </div>
    </motion.div>
  );
}

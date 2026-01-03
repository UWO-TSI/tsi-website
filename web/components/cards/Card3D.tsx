"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { getCardTransform, CARD_WIDTH, CARD_HEIGHT } from "./cardMath";
import type { PathwayCard } from "./types";

interface Props {
  card: PathwayCard;
  position: -1 | 0 | 1;
}

export default function Card3D({ card, position }: Props) {
  const router = useRouter();
  const { xOffset, yOffset, rotation } = getCardTransform(position);

  return (
    <motion.div
      className="pathway-card absolute"
      initial={false} // 🚫 CRITICAL
      animate={{
        x: xOffset - CARD_WIDTH / 2,
        y: yOffset,
        rotate: rotation,
        opacity: 1,
      }}
      transition={{
        x: { type: "spring", stiffness: 260, damping: 30 },
        rotate: { type: "spring", stiffness: 260, damping: 26 },
      }}
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        left: "50%",
        zIndex: 10 - Math.abs(position),
        transformOrigin: "center bottom",
        pointerEvents: "auto",
      }}
      onClick={() => card.href && router.push(card.href)}
    >
      <div className="glass-card w-full h-full rounded-2xl p-8 flex flex-col justify-center">
        <h3 className="text-2xl font-semibold mb-3 text-white">
          {card.title}
        </h3>
        <p className="text-sm text-zinc-400">
          {card.description}
        </p>
      </div>
    </motion.div>
  );
}

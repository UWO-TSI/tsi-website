"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import type { PathwayCard } from "./types";

// ================================
// CARD CONSTANTS (UNCHANGED)
// ================================
const CARD_WIDTH = 330;
const CARD_HEIGHT = 570;
const CARD_SPACING = 0.75;
const SMALL_LIFT = 30;
const MAX_FAN_ANGLE = 18;

function getCardTransform(index: number, totalCards: number) {
  const t = index - (totalCards - 1) / 2;
  const xOffset = t * (CARD_WIDTH * CARD_SPACING);
  const yOffset = Math.abs(t) * SMALL_LIFT;
  const rotation =
    totalCards > 1
      ? (t * MAX_FAN_ANGLE) / ((totalCards - 1) / 2)
      : 0;

  return { xOffset, yOffset, rotation };
}

export function Card3D({
  card,
  index,
  totalCards,
}: {
  card: PathwayCard;
  index: number;
  totalCards: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const breathingTween = useRef<gsap.core.Tween | null>(null);

  const breathingScale = useMotionValue(1);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(
    useTransform(mouseY, [-0.5, 0.5], [15, -15]),
    { stiffness: 150, damping: 20 }
  );
  const rotateY = useSpring(
    useTransform(mouseX, [-0.5, 0.5], [-15, 15]),
    { stiffness: 150, damping: 20 }
  );

  const { xOffset, yOffset, rotation } = getCardTransform(index, totalCards);

  const combinedScale = useTransform(
    breathingScale,
    (b) => (isHovered ? 1.15 : 1) * b
  );

  useEffect(() => {
    const obj = { value: 1 };
    breathingTween.current = gsap.to(obj, {
      value: 1.02,
      duration: 3.5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      delay: Math.random() * 2,
      onUpdate: () => breathingScale.set(obj.value),
    });

    return () => breathingTween.current?.kill();
  }, []);

  useEffect(() => {
    if (isHovered) {
      breathingTween.current?.pause();
      breathingScale.set(1);
    } else {
      setTimeout(() => breathingTween.current?.resume(), 300);
    }
  }, [isHovered]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    mouseX.set((e.clientX - (rect.left + rect.width / 2)) / rect.width);
    mouseY.set((e.clientY - (rect.top + rect.height / 2)) / rect.height);
  };

  return (
    <motion.div
      ref={cardRef}
      className="pathway-card absolute opacity-0"
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        x: xOffset,
        scale: combinedScale,
        transformOrigin: "center bottom",
        transformStyle: "preserve-3d",
        perspective: 1000,
        zIndex: isHovered ? 50 : index,
        pointerEvents: "none",
      }}
      initial={{ y: 150, scale: 0.8 }}
      animate={{
        y: isHovered ? yOffset - 10 : yOffset,
        rotate: isHovered ? rotation * 0.9 : rotation,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <motion.div
        className="glass-card w-full h-full p-8 flex flex-col justify-center relative"
        style={{
          rotateX: isHovered ? rotateX : 0,
          rotateY: isHovered ? rotateY : 0,
          transformStyle: "preserve-3d",
        }}
      >
        <div
          className="absolute inset-0 cursor-pointer"
          style={{ borderRadius: "22px", pointerEvents: "auto" }}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        />

        <motion.div
          className="absolute inset-0 rounded-[22px] pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${useTransform(
              mouseX,
              [-0.5, 0.5],
              [0, 100]
            )}% ${useTransform(mouseY, [-0.5, 0.5], [0, 100])}%, rgba(255,255,255,0.2) 0%, transparent 60%)`,
            opacity: isHovered ? 0.6 : 0,
          }}
        />

        <div className="relative z-10 pointer-events-none">
          <h3 className="font-heading text-2xl font-semibold mb-3">
            {card.title}
          </h3>
          <p className="text-sm text-zinc-400">{card.subtitle}</p>
        </div>

        <motion.div
          className="absolute -inset-2 rounded-[24px] blur-xl -z-10"
          style={{
            background:
              "radial-gradient(circle, rgba(0,47,167,0.4), transparent 70%)",
            opacity: isHovered ? 1 : 0,
          }}
        />
      </motion.div>
    </motion.div>
  );
}
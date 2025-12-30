"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useRouter } from "next/navigation";
import type { PathwayCard } from "./types";

/* =============================
   BALATRO FAN MATH
============================= */

const CARD_WIDTH = 330;
const CARD_HEIGHT = 570;
const CARD_SPACING = 0.75;
const SMALL_LIFT = 30;
const MAX_FAN_ANGLE = 18;

function getCardTransform(index: number, total: number) {
  const t = index - (total - 1) / 2;
  return {
    x: t * (CARD_WIDTH * CARD_SPACING),
    y: Math.abs(t) * SMALL_LIFT,
    rotation:
      total > 1 ? (t * MAX_FAN_ANGLE) / ((total - 1) / 2) : 0,
  };
}

/* =============================
   CARD COMPONENT
============================= */

export default function Card3D({
  card,
  index,
  totalCards,
}: {
  card: PathwayCard;
  index: number;
  totalCards: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  /* mouse tracking */
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  /* 3D tilt */
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [15, -15]), {
    stiffness: 150,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-15, 15]), {
    stiffness: 150,
    damping: 20,
  });

  /* breathing */
  const breathing = useMotionValue(1);
  useEffect(() => {
    const obj = { v: 1 };
    const t = gsap.to(obj, {
      v: 1.02,
      duration: 3.5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      onUpdate: () => breathing.set(obj.v),
    });
    return () => t.kill();
  }, []);

  const scale = useTransform(breathing, (b) => (hovered ? 1.1 : 1) * b);

  const { x, y, rotation } = getCardTransform(index, totalCards);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mouseX.set((e.clientX - r.left) / r.width - 0.5);
    mouseY.set((e.clientY - r.top) / r.height - 0.5);
  }

  function onLeave() {
    setHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  }

  return (
    <motion.div
      ref={ref}
      className="pathway-card absolute opacity-0"
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        x,
        scale,
        transformOrigin: "center bottom",
        perspective: 1000,
        zIndex: hovered ? 50 : index,
      }}
      initial={{ y: 150, scale: 0.8 }}
      animate={{
        y: hovered ? y - 60 : y,
        rotate: hovered ? rotation * 0.9 : rotation,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <motion.div
        className="glass-card w-full h-full p-8 flex flex-col justify-center relative"
        style={{ rotateX, rotateY }}
      >
        {/* hitbox */}
        <div
          className="absolute inset-0 cursor-pointer"
          style={{ borderRadius: 22 }}
          onMouseMove={onMove}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={onLeave}
          onClick={() => router.push(card.href)}
        />

        {/* shine */}
        <motion.div
          className="absolute inset-0 rounded-[22px] pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, rgba(255,255,255,.25), transparent 60%)",
            opacity: hovered ? 0.6 : 0,
          }}
        />

        {/* content */}
        <div className="relative z-10 pointer-events-none">
          <h3 className="font-heading text-2xl font-semibold mb-3">
            {card.title}
          </h3>
          <p className="text-sm text-zinc-400">{card.subtitle}</p>
        </div>

        {/* glow */}
        <motion.div
          className="absolute -inset-2 rounded-[24px] blur-xl -z-10"
          style={{
            background:
              "radial-gradient(circle, rgba(0,47,167,0.4), transparent 70%)",
            opacity: hovered ? 1 : 0,
          }}
        />
      </motion.div>
    </motion.div>
  );
}
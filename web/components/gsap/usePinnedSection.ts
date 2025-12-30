"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useRouter } from "next/navigation";
import { getCardTransform } from "./cardMath";
import type { PathwayCard } from "./types";

interface Props {
  card: PathwayCard;
  index: number;
  totalCards: number;
}

export default function Card3D({ card, index, totalCards }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const breathingTween = useRef<gsap.core.Tween | null>(null);
  const router = useRouter();

  // Separate breathing scale from hover scale
  const breathingScale = useMotionValue(1);

  // Mouse position relative to card center
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth 3D rotation with spring physics
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [15, -15]), {
    stiffness: 150,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-15, 15]), {
    stiffness: 150,
    damping: 20,
  });

  const { xOffset, yOffset, rotation } = getCardTransform(index, totalCards);

  // Combine breathing scale with hover scale
  const combinedScale = useTransform(breathingScale, (breathing) =>
    (isHovered ? 1.15 : 1) * breathing
  );

  // Shine overlay position (0–100%)
  const shineX = useTransform(mouseX, [-0.5, 0.5], [0, 100]);
  const shineY = useTransform(mouseY, [-0.5, 0.5], [0, 100]);

  // Setup breathing animation
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

    return () => {
      breathingTween.current?.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pause breathing on hover, resume on leave
  useEffect(() => {
    if (isHovered) {
      breathingTween.current?.pause();
      breathingScale.set(1);
    } else {
      const t = setTimeout(() => breathingTween.current?.resume(), 250);
      return () => clearTimeout(t);
    }
  }, [isHovered, breathingScale]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const x = (e.clientX - centerX) / rect.width;
    const y = (e.clientY - centerY) / rect.height;

    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      className="pathway-card absolute opacity-0"
      style={{
        width: 330,
        height: 570,
        x: xOffset,
        scale: combinedScale,
        transformOrigin: "center bottom",
        transformStyle: "preserve-3d",
        perspective: 1000,
        zIndex: isHovered ? 50 : index,
        pointerEvents: "none", // only hitbox gets pointer events
      }}
      initial={{ y: 150, scale: 0.8 }}
      animate={{
        y: isHovered ? yOffset - 60 : yOffset,
        rotate: isHovered ? rotation * 0.9 : rotation,
        // NOTE: opacity intentionally NOT animated here — GSAP controls it
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 25,
        mass: 0.5,
      }}
    >
      <motion.div
        className="glass-card w-full h-full p-8 flex flex-col justify-center relative"
        style={{
          rotateX: isHovered ? rotateX : 0,
          rotateY: isHovered ? rotateY : 0,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Precise hitbox */}
        <div
          className="absolute inset-0 cursor-pointer"
          style={{
            borderRadius: "22px",
            pointerEvents: "auto",
          }}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={handleMouseLeave}
          onClick={() => router.push(card.href)}
        />

        {/* Shine overlay */}
        <motion.div
          className="absolute inset-0 rounded-[22px] pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${shineX.get()}% ${shineY.get()}%, rgba(255,255,255,0.22) 0%, transparent 60%)`,
            opacity: isHovered ? 0.6 : 0,
          }}
          animate={{ opacity: isHovered ? 0.6 : 0 }}
          transition={{ duration: 0.25 }}
        />

        {/* Content */}
        <div className="relative z-10 pointer-events-none">
          <h3 className="font-heading text-2xl font-semibold mb-3">
            {card.title}
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {card.subtitle}
          </p>
        </div>

        {/* Blue glow on hover */}
        <motion.div
          className="absolute -inset-2 rounded-[24px] blur-xl pointer-events-none -z-10"
          style={{
            background:
              "radial-gradient(circle, rgba(0,47,167,0.45) 0%, transparent 70%)",
            opacity: isHovered ? 1 : 0,
          }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.25 }}
        />
      </motion.div>
    </motion.div>
  );
}
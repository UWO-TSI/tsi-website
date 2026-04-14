"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRouter } from "next/navigation";
import Image from "next/image";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface PathwayCard {
  title: string;
  subtitle: string;
  href: string;
  image: string;
}

const cards: PathwayCard[] = [
  {
    title: "Nonprofits",
    subtitle: "Pro bono software support for 1 year",
    href: "/npo",
    image: "/cards/heart.jpg",
  },
  {
    title: "Companies",
    subtitle: "Hire for scoped project and consulting",
    href: "/company",
    image: "/cards/forge.jpg",
  },
  {
    title: "Sponsors",
    subtitle: "Fund tech that drives social impact",
    href: "/sponsor",
    image: "/cards/hand.jpg",
  },
  {
    title: "Students",
    subtitle: "Start a TETHOS Chapter",
    href: "/student",
    image: "/cards/star.jpg",
  },
];

// ============================================
// CIRCULAR ARC BEND CALCULATIONS
// ============================================

const CARD_WIDTH = 310;
const CARD_HEIGHT = 415;
const CARD_SPACING = 260;
const BEND = -100;
const VERTICAL_OFFSET = -200;

function getCardTransform(index: number, totalCards: number) {
  const t = index - (totalCards - 1) / 2;
  const xOffset = t * CARD_SPACING;

  const outerCardT = (totalCards - 1) / 2;
  const H = outerCardT * CARD_SPACING;

  const bend = BEND;
  if (Math.abs(bend) < 0.001) {
    return { xOffset, yOffset: 0, rotation: 0 };
  }

  const B_abs = Math.abs(bend);
  const R = (H * H + B_abs * B_abs) / (2 * B_abs);

  const effectiveX = Math.min(Math.abs(xOffset), H);

  const arc = R - Math.sqrt(R * R - effectiveX * effectiveX);

  let yOffset: number;
  if (bend > 0) {
    yOffset = -arc;
  } else {
    yOffset = arc;
  }

  yOffset += VERTICAL_OFFSET;

  const theta = Math.asin(effectiveX / R);
  const rotationSign = Math.sign(xOffset);

  let rotation: number;
  if (bend > 0) {
    rotation = -rotationSign * theta;
  } else {
    rotation = rotationSign * theta;
  }

  rotation = (rotation * 180) / Math.PI;

  return { xOffset, yOffset, rotation };
}

// ============================================
// 3D CARD COMPONENT
// ============================================

function Card3D({ card, index, totalCards }: { card: PathwayCard; index: number; totalCards: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const breathingTween = useRef<gsap.core.Tween | null>(null);
  const router = useRouter();

  const { xOffset, yOffset, rotation } = getCardTransform(index, totalCards);

  // ============================================
  // IDLE ANIMATIONS
  // ============================================

  const breathingScale = useMotionValue(1);

  useEffect(() => {
    const breathingObject = { value: 1 };

    breathingTween.current = gsap.to(breathingObject, {
      value: 1.02,
      duration: 3.5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      delay: Math.random() * 2,
      onUpdate: () => {
        breathingScale.set(breathingObject.value);
      },
    });

    return () => {
      breathingTween.current?.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isHovered) {
      breathingTween.current?.pause();
      breathingScale.set(1);
    } else {
      setTimeout(() => {
        breathingTween.current?.resume();
      }, 300);
    }
  }, [isHovered, breathingScale]);

  // ============================================
  // HOVER ANIMATIONS
  // ============================================

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [15, -15]), {
    stiffness: 150,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-15, 15]), {
    stiffness: 150,
    damping: 20,
  });

  const shineX = useTransform(mouseX, [-0.5, 0.5], [0, 100]);
  const shineY = useTransform(mouseY, [-0.5, 0.5], [0, 100]);

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

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  };

  // ============================================
  // CLICK ANIMATIONS
  // ============================================

  const tapScale = useMotionValue(1);
  const springTapScale = useSpring(tapScale, {
    stiffness: 500,
    damping: 25,
    mass: 0.3,
  });

  const handlePointerDown = () => {
    tapScale.set(0.95);
  };

  const handlePointerUp = () => {
    if (!isHovered) {
      tapScale.set(1);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    tapScale.set(0.92);

    setTimeout(() => {
      tapScale.set(1.05);
      setTimeout(() => {
        tapScale.set(1);
      }, 80);
    }, 50);

    setTimeout(() => {
      router.push(card.href);
    }, 150);
  };

  // ============================================
  // COMBINED ANIMATIONS
  // ============================================

  const combinedScale = useTransform(
    [breathingScale, springTapScale],
    ([breathing, tap]: number[]) => (isHovered ? 1.08 : 1) * breathing * tap
  );

  return (
    <motion.div
      ref={cardRef}
      className="pathway-card absolute opacity-0"
      style={{
        width: `${CARD_WIDTH}px`,
        height: `${CARD_HEIGHT}px`,
        minWidth: `${CARD_WIDTH}px`,
        minHeight: `${CARD_HEIGHT}px`,
        maxWidth: `${CARD_WIDTH}px`,
        maxHeight: `${CARD_HEIGHT}px`,
        x: xOffset,
        scale: combinedScale,
        transformOrigin: "center bottom",
        transformStyle: "preserve-3d",
        perspective: 1000,
        zIndex: isHovered ? 50 : index,
        pointerEvents: "none",
      }}
      initial={{
        y: 150,
        scale: 0.8,
      }}
      animate={{
        y: isHovered ? yOffset - 20 : yOffset,
        rotate: isHovered ? rotation * 0.9 : rotation,
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 25,
        mass: 0.5,
      }}
    >
      <motion.div
        className="relative overflow-hidden rounded-[12px]"
        style={{
          width: `${CARD_WIDTH}px`,
          height: `${CARD_HEIGHT}px`,
          background: "#e8dcc4",
          rotateX: isHovered ? rotateX : 0,
          rotateY: isHovered ? rotateY : 0,
          transformStyle: "preserve-3d",
          boxShadow: isHovered
            ? "0 0 30px rgba(200, 168, 78, 0.25), 0 25px 60px rgba(0, 0, 0, 0.5)"
            : "0 18px 50px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Tarot card image */}
        <Image
          src={card.image}
          alt={card.title}
          fill
          className="object-contain pointer-events-none select-none"
          sizes="310px"
          priority
          draggable={false}
        />

        {/* Hitbox */}
        <div
          className="absolute inset-0 cursor-pointer"
          style={{
            borderRadius: "12px",
            pointerEvents: "auto",
          }}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onClick={handleClick}
        />

        {/* Gold foil shine on hover */}
        <motion.div
          className="absolute inset-0 rounded-[12px] pointer-events-none"
          style={{
            background: useTransform(
              [shineX, shineY],
              ([x, y]: number[]) =>
                `radial-gradient(circle at ${x}% ${y}%, rgba(200, 168, 78, 0.35) 0%, transparent 60%)`
            ),
            opacity: isHovered ? 0.8 : 0,
          }}
          animate={{
            opacity: isHovered ? 0.8 : 0,
          }}
          transition={{ duration: 0.3 }}
        />

        {/* Glow effect on hover */}
        <motion.div
          className="absolute -inset-2 rounded-[16px] blur-xl pointer-events-none -z-10"
          style={{
            background: "radial-gradient(circle, rgba(200, 168, 78, 0.3) 0%, transparent 70%)",
            opacity: isHovered ? 1 : 0,
          }}
          animate={{
            opacity: isHovered ? 1 : 0,
          }}
          transition={{ duration: 0.3 }}
        />
      </motion.div>
    </motion.div>
  );
}

// ============================================
// MAIN PATHWAY CARDS COMPONENT
// ============================================

export default function PathwayCards() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const helperTextRef = useRef<HTMLParagraphElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const ctx = gsap.context(() => {
      const mainTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "+=200%",
          scrub: 1,
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
        },
      });

      mainTimeline.fromTo(
        titleRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: "power2.inOut" },
        0
      );

      const cardElements = cardsContainerRef.current?.querySelectorAll(".pathway-card");
      if (cardElements) {
        cardElements.forEach((card, index) => {
          const startTime = 0.2 + (index * 0.12);

          mainTimeline.fromTo(
            card,
            {
              opacity: 0,
            },
            {
              opacity: 1,
              duration: 0.15,
              ease: "back.out(1.2)",
            },
            startTime
          );
        });
      }

      mainTimeline.fromTo(
        helperTextRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.2, ease: "power2.inOut" },
        0.8
      );

    }, sectionRef);

    const refreshTimer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 100);

    return () => {
      ctx.revert();
      clearTimeout(refreshTimer);
    };
  }, []);

  return (
    <section
      id="pathways"
      ref={sectionRef}
      data-navbar-theme="dark"
      className="h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "#0a0a0b" }}
    >
      <div className="flex flex-col items-center justify-end h-full px-6 pb-24 w-full">
        <h2
          ref={titleRef}
          className="font-heading text-5xl md:text-6xl font-semibold mb-auto mt-24 text-center opacity-0"
        >
          Who are you?
        </h2>

        <div ref={cardsContainerRef} className="relative w-full max-w-7xl mx-auto h-[600px]">
          {/* Desktop: Fanned card hand */}
          <div className="hidden md:block relative w-full h-full">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-36 flex items-end justify-center">
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

          {/* Mobile: Horizontal scroll */}
          <div className="md:hidden flex gap-4 w-full overflow-x-auto snap-x snap-mandatory px-4 py-8 -mx-4">
            {cards.map((card) => (
              <motion.div
                key={card.title}
                className="pathway-card snap-center shrink-0 cursor-pointer overflow-hidden rounded-[10px]"
                style={{
                  width: "220px",
                  height: "295px",
                  boxShadow: "0 12px 35px rgba(0, 0, 0, 0.4)",
                }}
                whileHover={{
                  scale: 1.02,
                  transition: { duration: 0.2 },
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push(card.href)}
              >
                <Image
                  src={card.image}
                  alt={card.title}
                  width={220}
                  height={295}
                  className="object-cover w-full h-full pointer-events-none select-none"
                  draggable={false}
                />
              </motion.div>
            ))}
          </div>
        </div>

        <p
          ref={helperTextRef}
          className="mt-0 mb-2 text-sm text-zinc-500 text-center opacity-0"
        >
          Not sure? Start with the card that feels closest to you
        </p>
      </div>
    </section>
  );
}

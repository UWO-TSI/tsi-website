"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRouter } from "next/navigation";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface PathwayCard {
  title: string;
  subtitle: string;
  href: string;
}

const cards: PathwayCard[] = [
  {
    title: "Nonprofits",
    subtitle: "Pro bono software support for 1 year",
    href: "/npo",
  },
  {
    title: "Companies",
    subtitle: "Hire for scoped project and consulting",
    href: "/company",
  },
  {
    title: "Sponsors",
    subtitle: "Fund tech that drives social impact",
    href: "/sponsor",
  },
  {
    title: "Students",
    subtitle: "Start a TETHOS Chapter",
    href: "/student",
  },
];

// ============================================
// CIRCULAR ARC BEND CALCULATIONS
// ============================================

const CARD_WIDTH = 350; // Card width in pixels (affects card size only)
const CARD_HEIGHT = 490; // Card height in pixels (affects card size only)
const CARD_SPACING = 280; // Horizontal spacing between card centers in pixels (independent of card width)
const BEND = -100; // Arc sagitta (curve depth). Positive = downward curve, negative = upward curve
// Recommendedrange: 2-5 for moderate curve, 5-10 for strong curve
const VERTICAL_OFFSET = -200; // Base vertical position offset in pixels. Positive = move down, negative = move up

function getCardTransform(index: number, totalCards: number) {
  const t = index - (totalCards - 1) / 2;
  // Use independent spacing value, not tied to card width
  const xOffset = t * CARD_SPACING;
  
  // Calculate H (half viewport width) based on card spread
  // H is the distance from center to the outermost card
  const outerCardT = (totalCards - 1) / 2;
  const H = outerCardT * CARD_SPACING;
  
  // Handle edge case: flat layout when bend is 0
  const bend = BEND;
  if (Math.abs(bend) < 0.001) {
    return { xOffset, yOffset: 0, rotation: 0 };
  }
  
  // Step 1: Calculate circle radius using sagitta formula
  // Use absolute value of bend for radius calculation
  const B_abs = Math.abs(bend);
  const R = (H * H + B_abs * B_abs) / (2 * B_abs);
  
  // Step 2: Clamp x to prevent going beyond the arc (for arc calculation only)
  // Take absolute value first, then clamp to H
  const effectiveX = Math.min(Math.abs(xOffset), H);
  
  // Step 3: Calculate vertical displacement (arc drop)
  const arc = R - Math.sqrt(R * R - effectiveX * effectiveX);
  
  // Step 4: Apply vertical position (with bend direction)
  let yOffset: number;
  if (bend > 0) {
    yOffset = -arc;  // Curve downward
  } else {
    yOffset = arc;   // Curve upward
  }
  
  // Add base vertical offset to move all cards up/down together
  yOffset += VERTICAL_OFFSET;
  
  // Step 5: Calculate and apply rotation angle (tangent to curve)
  // Use effectiveX (absolute, clamped) for theta calculation
  // Use original xOffset sign for rotation direction
  const theta = Math.asin(effectiveX / R);
  const rotationSign = Math.sign(xOffset);
  
  let rotation: number;
  if (bend > 0) {
    rotation = -rotationSign * theta;
  } else {
    rotation = rotationSign * theta;
  }
  
  // Convert rotation from radians to degrees
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
  
  // Breathing animation scale
  const breathingScale = useMotionValue(1);
  
  // Setup breathing animation using MotionValue
  useEffect(() => {
    const breathingObject = { value: 1 };
    
    breathingTween.current = gsap.to(breathingObject, {
      value: 1.02, // 2% scale change - more visible breathing
      duration: 3.5, // Slightly faster for better visibility
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
  }, []); // Empty deps - only run once on mount
  
  // Pause breathing on hover, resume on leave
  useEffect(() => {
    if (isHovered) {
      breathingTween.current?.pause();
      breathingScale.set(1); // Reset to 1 when hovering
    } else {
      // Small delay before resuming breathing
      setTimeout(() => {
        breathingTween.current?.resume();
      }, 300);
    }
  }, [isHovered, breathingScale]);
  
  // ============================================
  // HOVER ANIMATIONS
  // ============================================
  
  // Mouse position relative to card center for 3D tilt
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  // Spring physics for smooth 3D rotation (mimics Godot's spring/damp)
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [15, -15]), {
    stiffness: 150,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-15, 15]), {
    stiffness: 150,
    damping: 20,
  });
  
  // Handle mouse move for 3D tilt effect
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Normalize mouse position to [-0.5, 0.5] range
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
  
  // Tap/click scale for tactile feedback
  const tapScale = useMotionValue(1);
  const springTapScale = useSpring(tapScale, {
    stiffness: 500,
    damping: 25,
    mass: 0.3,
  });
  
  // Handle pointer down for immediate feedback
  const handlePointerDown = () => {
    tapScale.set(0.95);
  };
  
  // Handle pointer up
  const handlePointerUp = () => {
    // If it was just a press (not a click), reset scale
    // The click handler will handle the bounce animation
    if (!isHovered) {
      tapScale.set(1);
    }
  };
  
  // Handle click with tactile feedback
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Immediate scale down for tactile feel
    tapScale.set(0.92);
    
    // Quick bounce back with slight overshoot
    setTimeout(() => {
      tapScale.set(1.05);
      setTimeout(() => {
        tapScale.set(1);
      }, 80);
    }, 50);
    
    // Navigate after a brief delay to allow animation to be visible
    setTimeout(() => {
      router.push(card.href);
    }, 150);
  };
  
  // ============================================
  // DRAG ANIMATIONS
  // ============================================
  
  // (No drag functionality currently implemented)
  
  // ============================================
  // COMBINED ANIMATIONS
  // ============================================
  
  // Combine breathing scale with hover scale and tap scale
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
        x: xOffset, // Static horizontal position
        scale: combinedScale, // Breathing + hover scale combined
        transformOrigin: "center bottom",
        transformStyle: "preserve-3d",
        perspective: 1000,
        zIndex: isHovered ? 50 : index,
        pointerEvents: "none", // Disable pointer events on container
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
      {/* 3D Card Inner Container */}
      <motion.div
        className="glass-card p-8 flex flex-col justify-center relative"
        style={{
          width: `${CARD_WIDTH}px`,
          height: `${CARD_HEIGHT}px`,
          rotateX: isHovered ? rotateX : 0,
          rotateY: isHovered ? rotateY : 0,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Precise Hitbox - matches card shape exactly and follows 3D transforms */}
        <div
          className="absolute inset-0 cursor-pointer"
          style={{
            borderRadius: "22px", // Match glass-card border-radius
            pointerEvents: "auto", // Enable pointer events only on hitbox
          }}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onClick={handleClick}
        />
        {/* Shine overlay effect (appears on hover) */}
        <motion.div
          className="absolute inset-0 rounded-[22px] pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${useTransform(mouseX, [-0.5, 0.5], [0, 100])}% ${useTransform(mouseY, [-0.5, 0.5], [0, 100])}%, rgba(255,255,255,0.2) 0%, transparent 60%)`,
            opacity: isHovered ? 0.6 : 0,
          }}
          animate={{
            opacity: isHovered ? 0.6 : 0,
          }}
          transition={{ duration: 0.3 }}
        />
        
        {/* Card Content */}
        <div className="relative z-10 pointer-events-none">
          <h3 className="font-heading text-2xl font-semibold mb-3">
            {card.title}
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {card.subtitle}
          </p>
        </div>
        
        {/* Glow effect on hover */}
        <motion.div
          className="absolute -inset-2 rounded-[24px] blur-xl pointer-events-none -z-10"
          style={{
            background: "radial-gradient(circle, rgba(0,47,167,0.4) 0%, transparent 70%)",
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

      // 1. Fade in title
      mainTimeline.fromTo(
        titleRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: "power2.inOut" },
        0
      );

      // 2. Animate cards up one by one (ONLY opacity)
      const cardElements = cardsContainerRef.current?.querySelectorAll(".pathway-card");
      if (cardElements) {
        cardElements.forEach((card, index) => {
          const startTime = 0.2 + (index * 0.12);
          
          // Only animate opacity - Framer Motion handles position
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

      // 3. Fade in helper text
      mainTimeline.fromTo(
        helperTextRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.2, ease: "power2.inOut" },
        0.8
      );
      
      // Note: Breathing animation is now handled in Card3D component
      // Note: Card positioning is handled by Framer Motion in Card3D

    }, sectionRef);

    // Refresh ScrollTrigger after initial render
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
      ref={sectionRef}
      className="h-screen flex items-center justify-center relative bg-[#0F0F10] overflow-hidden"
    >
      <div className="flex flex-col items-center justify-end h-full px-6 pb-24 w-full">
        {/* Section Title */}
        <h2
          ref={titleRef}
          className="font-heading text-5xl md:text-6xl font-semibold mb-auto mt-24 text-center opacity-0"
        >
          Who are you?
        </h2>

        {/* Cards Container */}
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

          {/* Mobile: Simple stacked layout */}
          <div className="md:hidden flex flex-col gap-6 w-full max-w-md mx-auto">
            {cards.map((card) => (
              <motion.div
                key={card.title}
                className="pathway-card glass-card w-full min-h-[200px] p-6 flex flex-col justify-center cursor-pointer"
                whileHover={{
                  scale: 1.02,
                  transition: { duration: 0.2 },
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push(card.href)}
              >
                <h3 className="font-heading text-xl font-semibold mb-2">
                  {card.title}
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {card.subtitle}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Helper text */}
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
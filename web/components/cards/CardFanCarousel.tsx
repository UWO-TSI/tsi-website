"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CardFan } from "./CardFan";
import type { PathwayCard } from "./types";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

interface Props {
  cards: PathwayCard[];
}

export function CardFanCarousel({ cards }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const total = cards.length;

  /**
   * LEFT BUTTON (←)
   * Cards move LEFT
   * Left card exits
   * New card enters from RIGHT
   */
  const onLeft = () => {
    setActiveIndex((i) => (i + 1) % total);
  };

  /**
   * RIGHT BUTTON (→)
   * Cards move RIGHT
   * Right card exits
   * New card enters from LEFT
   */
  const onRight = () => {
    setActiveIndex((i) => (i - 1 + total) % total);
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.18,
          },
        },
      }}
      className="relative"
    >
      {/* LEFT BUTTON */}
      <motion.button
        variants={{
          hidden: { opacity: 0, y: 24 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.45, ease: "easeOut" },
          },
        }}
        onClick={onLeft}
        className="absolute left-8 top-1/2 z-20 text-white pointer-events-auto"
        aria-label="Previous"
      >
        <ChevronLeftIcon className="h-6 w-6" />
      </motion.button>

      {/* CARDS */}
      <CardFan cards={cards} activeIndex={activeIndex} />

      {/* RIGHT BUTTON */}
      <motion.button
        variants={{
          hidden: { opacity: 0, y: 24 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.45, ease: "easeOut" },
          },
        }}
        onClick={onRight}
        className="absolute right-8 top-1/2 z-20 text-white pointer-events-auto"
        aria-label="Next"
      >
        <ChevronRightIcon className="h-6 w-6" />
      </motion.button>
    </motion.div>
  );
}

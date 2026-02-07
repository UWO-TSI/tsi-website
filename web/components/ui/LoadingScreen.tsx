"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";

interface LoadingScreenProps {
  onStartFade?: () => void;
  minLoadTime?: number;
}

// ASCII characters for dissolve effect (light to dense)
const ASCII_CHARS = " .·:;+x#%@";

function generateAsciiGrid(
  cols: number,
  rows: number,
  progress: number
): string[] {
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = "";
    for (let c = 0; c < cols; c++) {
      // Wave-based dissolve: characters appear/disappear in a wave pattern
      const dist =
        Math.sqrt(
          Math.pow((c / cols - 0.5) * 2, 2) +
            Math.pow((r / rows - 0.5) * 2, 2)
        ) / 1.414;
      const threshold = progress * 1.5 - dist * 0.5;
      if (threshold > 0) {
        const seed = (r * 127 + c * 31 + Math.floor(progress * 10)) % ASCII_CHARS.length;
        const charIdx = Math.min(
          Math.floor(threshold * ASCII_CHARS.length),
          ASCII_CHARS.length - 1
        );
        line += ASCII_CHARS[Math.max(0, charIdx)];
      } else {
        line += " ";
      }
    }
    lines.push(line);
  }
  return lines;
}

export default function LoadingScreen({
  onStartFade,
  minLoadTime = 2000,
}: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [quote, setQuote] = useState<string>("");
  const [isVisible, setIsVisible] = useState(true);
  const [quotes, setQuotes] = useState<string[]>([]);
  const [asciiLines, setAsciiLines] = useState<string[]>([]);
  const [dissolvePhase, setDissolvePhase] = useState(false);
  const dissolveProgress = useRef(0);
  const rafRef = useRef<number>(0);

  // Grid dimensions for ASCII dissolve
  const cols = 60;
  const rows = 8;

  // Load quotes
  useEffect(() => {
    const loadQuotes = async () => {
      try {
        const response = await fetch("/quotes.txt");
        const text = await response.text();
        const quoteArray = text
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        setQuotes(quoteArray);
        if (quoteArray.length > 0) {
          setQuote(
            quoteArray[Math.floor(Math.random() * quoteArray.length)]
          );
        }
      } catch {
        setQuote("Loading your experience...");
      }
    };
    loadQuotes();
  }, []);

  // Progress simulation
  useEffect(() => {
    const startTime = Date.now();
    let animationFrame: number;

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const progressRatio = Math.min(1, elapsed / minLoadTime);
      const easedProgress = 1 - Math.pow(1 - progressRatio, 3);
      const targetProgress = Math.min(99, easedProgress * 100);

      setProgress((prev) => Math.max(prev, targetProgress));

      if (progressRatio < 1) {
        animationFrame = requestAnimationFrame(updateProgress);
      }
    };

    animationFrame = requestAnimationFrame(updateProgress);

    const timeout = setTimeout(() => {
      setProgress(100);
      // Begin ASCII dissolve-out phase
      setDissolvePhase(true);
    }, minLoadTime);

    return () => {
      cancelAnimationFrame(animationFrame);
      clearTimeout(timeout);
    };
  }, [minLoadTime]);

  // ASCII dissolve-out animation
  useEffect(() => {
    if (!dissolvePhase) return;

    const duration = 600; // ms for dissolve
    const start = Date.now();

    const animate = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(1, elapsed / duration);
      dissolveProgress.current = p;

      // Generate grid that dissolves IN then OUT
      const phase = p < 0.4 ? p / 0.4 : 1 - (p - 0.4) / 0.6;
      setAsciiLines(generateAsciiGrid(cols, rows, phase));

      if (p < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        // Dissolve complete — hard cut to content
        setIsVisible(false);
        if (onStartFade) onStartFade();
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafRef.current);
  }, [dissolvePhase, onStartFade, cols, rows]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: isVisible ? 1 : 0 }}
      transition={{ duration: 0.15, ease: "linear" }} // Hard cut, not slow fade
      className="fixed inset-0 z-[9999] bg-white flex items-center justify-center"
      style={{ pointerEvents: isVisible ? "auto" : "none" }}
    >
      <div className="w-full max-w-4xl mx-auto px-8 flex flex-col items-center justify-center min-h-screen relative">
        {/* Logo — top left */}
        <div className="absolute top-8 left-8">
          <span className="font-heading text-gray-900 text-sm font-semibold tracking-wide">
            TETHOS
          </span>
        </div>

        {/* Main content */}
        <div className="flex flex-col items-center gap-10 w-full">
          {/* Message */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="text-gray-500 text-base font-medium"
          >
            Your page is on the way.
          </motion.p>

          {/* Quote */}
          <motion.div
            key={quote}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="max-w-xl text-center"
          >
            <p className="text-gray-800 text-xl md:text-2xl font-light leading-relaxed">
              {quote || "Loading..."}
            </p>
          </motion.div>

          {/* ASCII dissolve overlay (appears at end) */}
          {dissolvePhase && asciiLines.length > 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <pre
                className="font-mono text-gray-400 text-[10px] leading-[12px] text-center select-none"
                style={{ letterSpacing: "2px" }}
              >
                {asciiLines.join("\n")}
              </pre>
            </div>
          )}

          {/* Progress bar */}
          <div className="w-full max-w-xs space-y-1.5">
            <div className="w-full h-[2px] bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="h-full bg-gray-800 rounded-full"
              />
            </div>
          </div>
        </div>

        {/* Percentage — bottom left */}
        <div className="absolute bottom-8 left-8">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-gray-400 text-xs font-mono"
          >
            {Math.round(progress)}%
          </motion.span>
        </div>
      </div>
    </motion.div>
  );
}

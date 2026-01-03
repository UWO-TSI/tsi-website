"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface LoadingScreenProps {
  onStartFade?: () => void;
  minLoadTime?: number; // Minimum time to show loading screen in ms
}

export default function LoadingScreen({ 
  onStartFade,
  minLoadTime = 2000 
}: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [quote, setQuote] = useState<string>("");
  const [isVisible, setIsVisible] = useState(true);
  const [quotes, setQuotes] = useState<string[]>([]);

  // Load quotes from txt file
  useEffect(() => {
    const loadQuotes = async () => {
      try {
        const response = await fetch("/quotes.txt");
        const text = await response.text();
        // Split by newlines and filter out empty lines
        const quoteArray = text
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        setQuotes(quoteArray);
        
        // Select a random quote
        if (quoteArray.length > 0) {
          const randomQuote = quoteArray[Math.floor(Math.random() * quoteArray.length)];
          setQuote(randomQuote);
        }
      } catch (error) {
        console.error("Failed to load quotes:", error);
        setQuote("Loading your experience...");
      }
    };

    loadQuotes();
  }, []);

  // Rotate quote randomly every few seconds (only if loading takes longer)
  useEffect(() => {
    if (quotes.length === 0 || quotes.length === 1) return;

    const interval = setInterval(() => {
      setQuote((current) => {
        // Ensure we don't show the same quote twice in a row
        let newQuote;
        do {
          newQuote = quotes[Math.floor(Math.random() * quotes.length)];
        } while (newQuote === current && quotes.length > 1);
        return newQuote;
      });
    }, 4000); // Change quote every 4 seconds

    return () => clearInterval(interval);
  }, [quotes]);

  // Simulate loading progress
  useEffect(() => {
    const startTime = Date.now();
    let animationFrame: number;
    
    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const progressRatio = Math.min(1, elapsed / minLoadTime);
      
      // Smooth progress curve (ease-out)
      const easedProgress = 1 - Math.pow(1 - progressRatio, 3);
      const targetProgress = Math.min(99, easedProgress * 100);
      
      setProgress((prev) => {
        // Only update if we're moving forward
        return Math.max(prev, targetProgress);
      });

      if (progressRatio < 1) {
        animationFrame = requestAnimationFrame(updateProgress);
      }
    };

    animationFrame = requestAnimationFrame(updateProgress);

    // Ensure minimum load time and complete when done
    const timeout = setTimeout(() => {
      setProgress(100);
      // Start fade out - trigger home page to start fading in simultaneously
      setIsVisible(false);
      if (onStartFade) {
        onStartFade();
      }
    }, minLoadTime);

    return () => {
      cancelAnimationFrame(animationFrame);
      clearTimeout(timeout);
    };
  }, [minLoadTime, onStartFade]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: isVisible ? 1 : 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: "easeInOut" }}
      className="fixed inset-0 z-[9999] bg-white flex items-center justify-center"
      style={{ pointerEvents: isVisible ? "auto" : "none" }}
    >
          <div className="w-full max-w-4xl mx-auto px-8 flex flex-col items-center justify-center min-h-screen">
            {/* Logo placeholder - top left */}
            <div className="absolute top-8 left-8">
              <div className="w-32 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-gray-500 text-sm font-medium">logo</span>
              </div>
            </div>

            {/* Main content container */}
            <div className="flex flex-col items-center gap-12 w-full">
              {/* Message - center top */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <div className="bg-gray-100 rounded-lg px-6 py-3">
                  <p className="text-gray-600 text-lg font-medium">
                    Your page is on the way.
                  </p>
                </div>
              </motion.div>

              {/* Quote - center */}
              <motion.div
                key={quote}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4 }}
                className="max-w-2xl text-center"
              >
                <div className="bg-gray-50 rounded-xl px-8 py-6 border border-gray-200">
                  <p className="text-gray-800 text-2xl md:text-3xl font-light leading-relaxed">
                    {quote || "Loading..."}
                  </p>
                </div>
              </motion.div>

              {/* Progress bar */}
              <div className="w-full max-w-md space-y-2">
                <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="h-full bg-gray-600 rounded-full"
                  />
                </div>
                <p className="text-xs text-gray-400 text-center">Progress bar</p>
              </div>
            </div>

            {/* Percentage indicator - bottom left */}
            <div className="absolute bottom-8 left-8">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-gray-100 rounded-lg px-4 py-2"
              >
                <span className="text-gray-600 text-sm font-medium">
                  {Math.round(progress)}%
                </span>
              </motion.div>
            </div>
          </div>
        </motion.div>
  );
}

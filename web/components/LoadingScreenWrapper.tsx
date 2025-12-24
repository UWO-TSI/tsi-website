"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import LoadingScreen from "@/components/ui/LoadingScreen";

export default function LoadingScreenWrapper({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);

  const handleStartFade = () => {
    // Start showing home page and fade out loading screen simultaneously
    setShowContent(true);
    // After fade completes, remove loading screen
    setTimeout(() => {
      setIsLoading(false);
    }, 1000); // Match fade duration
  };

  return (
    <>
      {isLoading && (
        <LoadingScreen 
          onStartFade={handleStartFade}
          minLoadTime={2000} 
        />
      )}
      {showContent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, ease: "easeInOut" }}
          className="relative"
        >
          {children}
        </motion.div>
      )}
    </>
  );
}

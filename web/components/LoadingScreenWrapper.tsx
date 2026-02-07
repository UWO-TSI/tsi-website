"use client";

import { useState, useCallback } from "react";
import LoadingScreen from "@/components/ui/LoadingScreen";

export default function LoadingScreenWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLoading, setIsLoading] = useState(true);

  const handleStartFade = useCallback(() => {
    // Hard cut — no slow crossfade. Loading disappears, content appears.
    setIsLoading(false);
  }, []);

  return (
    <>
      {isLoading && (
        <LoadingScreen onStartFade={handleStartFade} minLoadTime={2000} />
      )}
      <div
        className="relative"
        style={{ visibility: isLoading ? "hidden" : "visible" }}
      >
        {children}
      </div>
    </>
  );
}

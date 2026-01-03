"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface CarouselControlsProps {
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
  className?: string;
}

export function CarouselControls({
  onPrev,
  onNext,
  disabled = false,
  className = "",
}: CarouselControlsProps) {
  const baseButton =
    "pointer-events-auto flex items-center justify-center w-10 h-10 rounded-full transition-all duration-150";
  const hover =
    "hover:bg-white/15";
  const active =
    "active:scale-95"; // 👈 tactile, not visual-heavy
  const disabledStyles =
    "disabled:opacity-40 disabled:pointer-events-none";

  return (
    <div className={`flex justify-between pointer-events-none ${className}`}>
      <button
        onClick={onPrev}
        disabled={disabled}
        aria-label="Previous"
        className={`${baseButton} ${hover} ${active} ${disabledStyles}`}
      >
        <ChevronLeftIcon className="h-5 w-5 text-white transition-transform duration-150 active:-translate-x-0.5" />
      </button>

      <button
        onClick={onNext}
        disabled={disabled}
        aria-label="Next"
        className={`${baseButton} ${hover} ${active} ${disabledStyles}`}
      >
        <ChevronRightIcon className="h-5 w-5 text-white transition-transform duration-150 active:translate-x-0.5" />
      </button>
    </div>
  );
}

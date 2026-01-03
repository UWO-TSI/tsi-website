"use client";

interface ScrollIndicatorProps {
  targetId?: string;
  className?: string;
}

export default function ScrollIndicator({ 
  targetId,
  className = "" 
}: ScrollIndicatorProps) {

  const handleClick = () => {
    if (targetId) {
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      // Scroll down by viewport height
      window.scrollBy({ top: window.innerHeight, behavior: "smooth" });
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`cursor-none bg-transparent border-0 p-0 flex items-center justify-center scale-50 ${className}`}
      aria-label="Scroll down"
    >
      <div className="mouse"></div>
    </button>
  );
}


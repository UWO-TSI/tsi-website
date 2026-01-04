import React from 'react';

export default function ConstructionBanner() {
  return (
    <div className="w-full overflow-hidden bg-black">
      <div className="flex animate-scroll">
        {/* Duplicate the image multiple times for seamless loop */}
        {[...Array(3)].map((_, i) => (
          <img
            key={i}
            src="/webcons2.png"
            alt="Website Under Construction"
            className="h-8 flex-shrink-0"
          />
        ))}
      </div>
      
      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.333%);
          }
        }
        
        .animate-scroll {
          animation: scroll 45s linear infinite;
          width: max-content;
        }
        
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
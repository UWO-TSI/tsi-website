"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ScrollIndicator from "@/components/ui/ScrollIndicator";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function NPOHomePage() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
	const ctx = gsap.context(() => {
	  // Initial entrance animation
	  gsap.from(contentRef.current, {
		opacity: 0,
		duration: 1.2,
		ease: "power3.out",
		delay: 0.3,
	  });

	  // Create a timeline for the fade out effect
	  // Pin the section while fading content from 1 to 0
	  const timeline = gsap.timeline({
		scrollTrigger: {
		  trigger: sectionRef.current,
		  start: "top top",
		  end: "+=150%", // Pin for 1.5 viewport heights (adjust for slower/faster fade)
		  scrub: 1, // Smooth scrubbing (1 = slight lag for smoothness)
		  pin: true,
		  pinSpacing: true, // Maintain spacing so next section waits
		  anticipatePin: 1,
		},
	  });

	  // Fade out content
	  timeline.to(contentRef.current, {
		opacity: 0,
		ease: "power2.inOut",
		duration: 1,
	  });

	}, sectionRef);

	return () => ctx.revert();
  }, []);

  return (
	<section
	  ref={sectionRef}
	  className="h-screen flex items-center justify-center relative bg-[#0F0F10]"
	>
	  <div
		ref={contentRef}
		className="flex flex-col items-center justify-center px-6 text-center w-full h-full"
	  >
		{/* Stack: three rectangles centered */}
		<div className="flex flex-col items-center justify-center w-full py-[4vh] gap-[2vh] mt-[-20vh]">
		  {/* Rectangle 1 (smaller, sits above centered group) */}
					<div
						className="w-[60vw] max-w-[1200px] bg-[#FF4DA6] rounded-md flex items-center justify-center px-6 py-6 mt-0"
						style={{ boxShadow: '0 6px 18px rgba(255,77,166,0.08)' }}
					>
			<span className="font-heading text-white text-lg text-center">
				documentary/footage working background
			</span>
		  </div>

		  {/* Rectangle 2 (anchored visually at center via container padding) */}
				<div
					className="w-[60vw] max-w-[1200px] bg-[#0F0F10] rounded-md flex items-center justify-center px-6 py-10 mt-0"
				>
			<div className="font-heading text-white text-center text-[45px] leading-tight">
				<span className="block">Software that Empowers</span>
				<span className="block mt-2 text-[3c8px] font-medium"> Nonprofits.</span>
			</div>
		  </div>

		  {/* Rectangle 3: two halves (below centered group) */}
					<div
						className="w-[60vw] max-w-[1200px] bg-[#0F0F10] rounded-md flex mt-[-4vh]"
					>
			{/* Left half */}
						<div className="flex-1 flex flex-col items-center justify-center p-6">
														<button className="rounded-full bg-[#27272A] border border-neutral-700 px-4 py-2 text-[18px] font-medium text-[#F1FFFF] transition-all hover:bg-[#0f0f10] mb-4">
								Apply for 2026 Yearly Cohort
							</button>
						</div>

			{/* Right half */}
						<div className="flex-1 flex flex-col items-center justify-center p-6">
														<button className="rounded-full bg-[#27272A] border border-neutral-700 px-4 py-2 text-[18px] font-medium text-[#F1FFFF] transition-all hover:bg-[#0f0f10] mb-4">
								Download our program package
							</button>
						</div>
		  </div>
		</div>
		  {/* Scroll indicator and text - placed directly below the stacked rectangles */}
		  <div className="mt-6 flex flex-col items-center gap-4 mt-[-2vh]">
			<ScrollIndicator />
			<span className="text-[14px] font-light leading-[1.5] text-[#A1A1AA]">
				Discover who we serve
			</span>
		  </div>
	  </div>
	</section>
  );
}
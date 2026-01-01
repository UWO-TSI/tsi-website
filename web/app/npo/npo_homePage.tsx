"use client";

import { ReactNode, useEffect, useRef, Children } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ScrollIndicator from "@/components/ui/ScrollIndicator";

if (typeof window !== "undefined") {
	gsap.registerPlugin(ScrollTrigger);
}

export default function NPOHomePage({ children }: { children?: ReactNode }) {
	const heroRef = useRef<HTMLDivElement>(null);
	const heroContentRef = useRef<HTMLDivElement>(null);
	const scrollIndicatorRef = useRef<HTMLDivElement>(null);
	const sectionsRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const ctx = gsap.context(() => {
			// Fade in hero content on load
			gsap.fromTo(
				heroContentRef.current,
				{ opacity: 0, y: 50 },
				{ opacity: 1, y: 0, duration: 1, ease: "power3.out" }
			);

			// Set scroll indicator to visible initially
			gsap.set(scrollIndicatorRef.current, { opacity: 1 });

			// Fade out scroll indicator quickly on first scroll
			ScrollTrigger.create({
				trigger: heroRef.current,
				start: "top top",
				end: "top+=500 top",
				scrub: true,
				onUpdate: (self) => {
					const opacity = Math.max(0, 1 - self.progress);
					gsap.to(scrollIndicatorRef.current, { opacity, duration: 0, ease: "none" });
				},
			});

			// Pin hero while next section reveals (no fade)
			ScrollTrigger.create({
				trigger: heroRef.current,
				start: "top top",
				end: "+=250%",
				scrub: true,
				pin: true,
				pinSpacing: true,
				anticipatePin: 1,
			});

			// Stagger in downstream sections when they enter the viewport
			const childSections = sectionsRef.current?.children
				? Array.from(sectionsRef.current.children)
				: [];

			if (childSections.length) {
				gsap.fromTo(
					childSections,
					{ opacity: 0, y: 30 },
					{
						opacity: 1,
						y: 0,
						duration: 0.8,
						stagger: 0.2,
						ease: "power2.out",
						scrollTrigger: {
							trigger: sectionsRef.current,
							start: "top 80%",
						},
					}
				);
			}
		}, heroRef);

		// Refresh after assets load to ensure correct trigger positions
		const refreshTimer = setTimeout(() => {
			ScrollTrigger.refresh();
		}, 100);

		const handleLoad = () => {
			ScrollTrigger.refresh();
		};

		window.addEventListener("load", handleLoad);

		return () => {
			ctx.revert();
			clearTimeout(refreshTimer);
			window.removeEventListener("load", handleLoad);
		};
	}, []);

	return (
		<main className="min-h-screen bg-[#0F0F10]">
			{/* Hero Section */}
			<section
				ref={heroRef}
				className="min-h-screen flex items-center justify-center px-6 pt-32 pb-20 relative overflow-hidden">
				<div ref={heroContentRef} className="max-w-4xl mx-auto text-center">
					<h1 className="font-heading text-6xl md:text-7xl font-semibold mb-6">
						For Nonprofits
					</h1>
					<p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
						Pro bono software support for 1 year. We build modern solutions
						that help you serve your community better.
					</p>
					<div className="flex gap-4 justify-center">
						<button className="rounded-full bg-[#002FA7] px-6 py-3 text-sm font-medium text-[#F1FFFF] transition-all hover:bg-[#0039CC]">
							Apply Now
						</button>
						<button className="rounded-full border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-300 transition-all hover:border-zinc-500 hover:text-white">
							Learn More
						</button>
					</div>
				</div>

				{/* Scroll indicator pinned to bottom of the viewport */}
				<div
					ref={scrollIndicatorRef}
					className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-50"
				>
					<ScrollIndicator />
					<span className="text-sm font-light leading-[1.5] text-zinc-400">
						Scroll down to explore
					</span>
				</div>
			</section>

			{/* Content Sections: each child fills a viewport */}
			<section ref={sectionsRef} className="w-full">
				{Children.count(children) > 0 &&
					Children.map(children, (child) => (
						<div className="min-h-screen flex items-center justify-center px-6">
							<div className="max-w-6xl w-full">
								{child}
							</div>
						</div>
					))}
			</section>
		</main>
	);
}
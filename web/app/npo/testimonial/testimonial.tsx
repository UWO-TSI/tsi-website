"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

export type TestimonialProps = {
	title?: string;
	subtitle?: string;
	videoSrc?: string;
	videoDescription?: string;
};

export default function Testimonial({
	title = "Hear From the Nonprofits We’ve Worked With",
	subtitle =
		"Real stories from organizations who partnered with TETHOS for technical support, digital transformation, and long-term impact.",
	videoSrc,
	videoDescription = "Video playing in the background – 15–20 second compilation of video testimonials.",
}: TestimonialProps) {
	const sectionRef = useRef<HTMLElement>(null);
	const titleRef = useRef<HTMLHeadingElement>(null);
	const subtitleRef = useRef<HTMLParagraphElement>(null);
	const descriptionRef = useRef<HTMLParagraphElement>(null);

	useEffect(() => {
		gsap.registerPlugin(ScrollTrigger);
	}, []);

	useEffect(() => {
		gsap.registerPlugin(ScrollTrigger);
		if (!sectionRef.current || !titleRef.current || !subtitleRef.current || !descriptionRef.current) return;

		const ctx = gsap.context(() => {
			const targets = [titleRef.current, subtitleRef.current, descriptionRef.current];

			gsap.set(targets, { autoAlpha: 0, y: 32 });

			gsap.timeline({
				defaults: { ease: "power2.out" },
				scrollTrigger: {
					trigger: sectionRef.current,
					start: "top bottom",
					end: "center center",
					scrub: 1,
					invalidateOnRefresh: true,
				},
			})
				.to(targets, { y: 0, autoAlpha: 1, stagger: 0.2, duration: 0.8 }, 0);
		});

		return () => ctx.revert();
	}, []);

	return (
		<section
			ref={sectionRef}
			className="relative isolate min-h-screen overflow-hidden bg-gradient-to-b from-[#0F0F10] via-[#181B1B] to-[#111113] text-white before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-24 before:bg-gradient-to-b before:from-[#0F0F10] before:via-[#0F0F10]/70 before:to-transparent"
		>
			<div className="absolute inset-0">
				{videoSrc ? (
					<video
						src={videoSrc}
						className="h-full w-full object-cover"
						playsInline
						autoPlay
						muted
						loop
						aria-hidden
					/>
				) : (
					<div
						className="h-full w-full bg-gradient-to-br from-[#181B1B] via-[#27272A] to-[#3F3F46]"
						aria-hidden
					/>
				)}
				<div
					className="absolute inset-0 bg-gradient-to-b from-[#0F0F10]/70 via-[#0D1B2A]/55 to-[#0F0F10]/45"
					aria-hidden
				/>
			</div>

			<div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
				<h1
					ref={titleRef}
					className="font-heading text-3xl font-semibold leading-tight text-white opacity-0 sm:text-4xl md:text-5xl"
				>
					{title}
				</h1>
				<p
					ref={subtitleRef}
					className="mt-4 max-w-3xl text-base text-zinc-100 opacity-0 sm:text-lg md:text-xl"
				>
					{subtitle}
				</p>
				<p
					ref={descriptionRef}
					className="mt-8 rounded-full bg-white/85 px-5 py-2 text-sm font-medium text-[#0F0F10] shadow-sm ring-1 ring-black/5 opacity-0"
				>
					{videoDescription}
				</p>
			</div>
		</section>
	);
}

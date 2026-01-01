"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
	gsap.registerPlugin(ScrollTrigger);
}

type ProjectCard = {
	name: string;
	org: string;
	role: string;
	image: string;
	summary: string;
	tags: string[];
};

const projects: ProjectCard[] = [
	{
		name: "Donor Nexus",
		org: "BrightAid",
		role: "Full-stack rebuild",
		image: "",
		summary: "Recurring giving portal with wallet pay and analytics uplift.",
		tags: ["Next.js", "Stripe", "Postgres"],
	},
	{
		name: "Green Routes",
		org: "FoodBridge",
		role: "Dispatch & logistics",
		image: "",
		summary: "Route batching, live ETAs, and volunteer mobile handoffs.",
		tags: ["Mapbox", "Node", "Redis"],
	},
	{
		name: "Hearth",
		org: "ShelterNet",
		role: "Intake CRM",
		image: "",
		summary: "Privacy-safe case tracking with exports for grant reports.",
		tags: ["React", "Supabase", "Auth"],
	},
	{
		name: "Crew Call",
		org: "GreenSteps",
		role: "Volunteer scheduling",
		image: "",
		summary: "SMS reminders, load-balanced shifts, on-call coordinator tools.",
		tags: ["Twilio", "Prisma", "Tailwind"],
	},
	{
		name: "Harvest Hub",
		org: "FreshField",
		role: "Inventory + routing",
		image: "",
		summary: "Produce intake, grading, and outbound routing dashboard for co-ops.",
		tags: ["React", "D3", "Hasura"],
	},
	{
		name: "Bridge Link",
		org: "ShelterBridge",
		role: "Housing referrals",
		image: "",
		summary: "Referral exchange with waitlist transparency across partner shelters.",
		tags: ["Next.js", "tRPC", "Postgres"],
	},
	{
		name: "MealMatch",
		org: "CityMeals",
		role: "Dispatch + SMS",
		image: "",
		summary: "Hot-meal delivery batching with driver SMS confirmations.",
		tags: ["Node", "Twilio", "Redis"],
	},
	{
		name: "Grant Glass",
		org: "GrantWorks",
		role: "Reporting workspace",
		image: "",
		summary: "Milestone tracker with exportable narratives and budget rollups.",
		tags: ["Supabase", "React", "Tailwind"],
	},
	{
		name: "Pulse",
		org: "HealthConnect",
		role: "Screening forms",
		image: "",
		summary: "Mobile-friendly intake with scoring and care-path suggestions.",
		tags: ["Next.js", "Zod", "Prisma"],
	},
	{
		name: "Volunteer HQ",
		org: "ServeTogether",
		role: "Volunteer CRM",
		image: "",
		summary: "Interest tagging, shift signup, and hours attestations in one view.",
		tags: ["React", "Supabase", "Auth"],
	},
	{
		name: "Pathways",
		org: "YouthRise",
		role: "Mentorship matching",
		image: "",
		summary: "Match mentors with youth based on goals, time, and proximity.",
		tags: ["Next.js", "Postgres", "Clerk"],
	},
	{
		name: "Relief Ops",
		org: "ReliefNow",
		role: "Field logistics",
		image: "",
		summary: "Kit counts, drop sites, and driver handoff receipts for crisis ops.",
		tags: ["Node", "Mapbox", "Redis"],
	},
	{
		name: "Navigator",
		org: "CareLine",
		role: "Case navigator",
		image: "",
		summary: "Call notes, warm handoffs, and follow-up reminders in one queue.",
		tags: ["Next.js", "tRPC", "Postgres"],
	},
	{
		name: "Bloom",
		org: "GardenAid",
		role: "Plot planner",
		image: "",
		summary: "Garden plot planning with seed inventory and volunteer calendars.",
		tags: ["React", "Tailwind", "Supabase"],
	},
];

export default function Impact() {
	const wrapperRef = useRef<HTMLElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);
	const columns = Math.ceil(projects.length / 2);

	useEffect(() => {
		const ctx = gsap.context(() => {
			const track = trackRef.current;
			const wrapper = wrapperRef.current;
			if (!track || !wrapper) return;

			const cardCount = projects.length;
			const scrollTween = gsap.to(track, {
				xPercent: -100 * (cardCount - 1),
				ease: "none",
				scrollTrigger: {
					trigger: wrapper,
					start: "top top",
					end: () => "+=" + (track.scrollWidth - window.innerWidth),
					scrub: true,
					pin: true,
					anticipatePin: 1,
					invalidateOnRefresh: true,
				},
			});

			Array.from(track.children).forEach((panel) => {
				ScrollTrigger.create({
					trigger: panel as HTMLElement,
					containerAnimation: scrollTween,
					start: "center center",
					end: "center center",
					onEnter: () => panel.classList.add("ring-4", "ring-blue-500"),
					onLeave: () => panel.classList.remove("ring-4", "ring-blue-500"),
					onEnterBack: () => panel.classList.add("ring-4", "ring-blue-500"),
					onLeaveBack: () => panel.classList.remove("ring-4", "ring-blue-500"),
				});
			});
		}, wrapperRef);

		return () => ctx.revert();
	}, []);

	return (
		<section
			ref={wrapperRef}
			className="min-h-screen bg-[#05060A] text-white px-0 overflow-hidden"
		>
			<div className="w-full px-4 pt-8 pb-0">
				<header className="mb-4 text-center">
					<p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Impact Gallery</p>
					<p className="mt-2 text-2xl md:text-3xl font-semibold">2025/2026 Project Gallery</p>
				</header>
			</div>

			<div
				ref={trackRef}
				className="grid grid-rows-2 grid-flow-col h-[70vh] px-4 pb-0"
				style={{
					width: `${columns * 20}vw`,
					gridAutoColumns: "minmax(220px, 25vw)",
				}}
			>
				{projects.map((card) => (
					<article
						key={card.name}
						className="group relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#0c0f1c] to-[#080910] border border-[#11182c] shadow-[0_16px_40px_rgba(0,0,0,0.3)] transition-transform duration-300 ease-out hover:-translate-y-2 hover:scale-[1.02] min-h-[360px] min-w-[220px] flex-shrink-0"
						style={{ perspective: "1200px" }}
					>

						<div className="relative p-4 flex flex-col gap-3 h-full">
							{/* Tall placeholder visual block */}
							<div className="w-full h-32 rounded-xl bg-[#11182c] border border-[#1f2d4a]" />

							<div className="flex items-center gap-3">
								<div className="h-10 w-10 rounded-xl bg-[#0f172a] border border-[#1c2a4a] flex items-center justify-center">
									<div className="h-7 w-7 rounded-lg bg-[#1f2d4a]" />
								</div>
								<div>
									<p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{card.org}</p>
									<h3 className="text-xl font-semibold leading-tight">{card.name}</h3>
									<p className="text-sm text-[#8ea0c2]">{card.role}</p>
								</div>
							</div>

							<p className="text-sm text-zinc-300 leading-relaxed">{card.summary}</p>

							<div className="flex flex-wrap gap-2">
								{card.tags.map((tag) => (
									<span
										key={tag}
										className="text-xs px-3 py-1 rounded-full bg-[#0f1a2c] border border-[#1f2d4a] text-[#c6d4ff]"
									>
										{tag}
									</span>
								))}
							</div>
						</div>

						{/* Hover enlarge effect */}
						<div className="absolute inset-0 scale-100 group-hover:scale-[1.03] transition-transform duration-300 pointer-events-none" />
					</article>
				))}
			</div>
		</section>
	);
}


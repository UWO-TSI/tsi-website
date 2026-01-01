"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
	gsap.registerPlugin(Draggable, ScrollTrigger);
}

type ProjectCard = {
	name: string;
	org: string;
	role: string;
	image: string;
	summary: string;
	tags: string[];
};

function ProjectCard({ card }: { card: ProjectCard }) {
	return (
		<article
			className="group relative overflow-visible rounded-2xl bg-gradient-to-b from-[#111113] to-[#0F0F10] border border-[#27272A] shadow-[0_16px_40px_rgba(0,0,0,0.3)] transition-all duration-300 ease-out hover:shadow-[0_32px_80px_rgba(0,0,0,0.9)] min-h-[360px] min-w-[220px] flex-shrink-0"
			style={{ perspective: "1200px" }}
		>
			<div className="relative p-4 flex flex-col gap-3 h-full">
				{/* Tall placeholder visual block */}
				<div className="w-full h-32 rounded-xl bg-[#27272A] border border-[#3F3F46]" />

				<div className="flex items-center gap-3">
					<div className="h-10 w-10 rounded-xl bg-[#1A1A1A] border border-[#3F3F46] flex items-center justify-center">
						<div className="h-7 w-7 rounded-lg bg-[#27272A]" />
					</div>
					<div>
						<p className="text-xs uppercase tracking-[0.2em]" style={{ color: '#A1A1AA' }}>{card.org}</p>
						<h3 className="text-xl font-semibold leading-tight">{card.name}</h3>
						<p className="text-sm" style={{ color: '#71717A' }}>{card.role}</p>
					</div>
				</div>

				<p className="text-sm leading-relaxed" style={{ color: '#A1A1AA' }}>{card.summary}</p>

				<div className="flex flex-wrap gap-2">
					{card.tags.map((tag) => (
						<span
							key={tag}
							className="text-xs px-3 py-1 rounded-full border border-[#3F3F46] text-white"
							style={{ backgroundColor: '#1A1A1A' }}
						>
							{tag}
						</span>
					))}
				</div>
			</div>

			{/* Hover enlarge effect */}
			<div className="absolute inset-0 scale-100 group-hover:[transform:scaleX(2)_scaleY(1.5)] transition-transform duration-300 pointer-events-none" />
		</article>
	);
}

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
	{
		name: "CoConnect",
		org: "YouthServe",
		role: "Youth engagement app",
		image: "",
		summary: "Social network for volunteers to coordinate local service projects.",
		tags: ["React Native", "Firebase", "Maps"],
	},
	{
		name: "WaterFlow",
		org: "CleanWater",
		role: "Water quality dashboard",
		image: "",
		summary: "Real-time sensor monitoring and contamination alerts for communities.",
		tags: ["Node", "PostgreSQL", "InfluxDB"],
	},
	{
		name: "SafeHome",
		org: "DomesticAid",
		role: "Safety planning CRM",
		image: "",
		summary: "Confidential planning and resource coordination for survivors.",
		tags: ["Next.js", "Supabase", "Encryption"],
	},
	{
		name: "FoodChain",
		org: "SupplyHub",
		role: "Food distribution logistics",
		image: "",
		summary: "End-to-end supply chain tracking from donors to beneficiaries.",
		tags: ["React", "GraphQL", "Postgres"],
	},
	{
		name: "LessonsUp",
		org: "EducateAll",
		role: "Tutor matching platform",
		image: "",
		summary: "Peer tutoring marketplace connecting students with volunteer educators.",
		tags: ["Next.js", "Prisma", "Stripe"],
	},
	{
		name: "JobReady",
		org: "CareerBridge",
		role: "Job training portal",
		image: "",
		summary: "Skill assessments, training modules, and employer referrals.",
		tags: ["React", "Node", "MongoDB"],
	},
	{
		name: "MediAlert",
		org: "HealthGuard",
		role: "Medication reminder system",
		image: "",
		summary: "SMS-based adherence tracking with caregiver notifications.",
		tags: ["Twilio", "Prisma", "Node"],
	},
	{
		name: "ProBono",
		org: "LawyersCare",
		role: "Legal services intake",
		image: "",
		summary: "Intake forms and case management for pro bono legal clinics.",
		tags: ["React", "Supabase", "Tailwind"],
	},
	{
		name: "SeniorConnect",
		org: "AgeWell",
		role: "Elderly care coordination",
		image: "",
		summary: "Family portal for coordinating care visits and health updates.",
		tags: ["Next.js", "Firebase", "Auth0"],
	},
	{
		name: "HousingHub",
		org: "RoofGiving",
		role: "Affordable housing platform",
		image: "",
		summary: "Listing and application management for low-income housing.",
		tags: ["React", "Postgres", "Mapbox"],
	},
	{
		name: "MentorPair",
		org: "NextGen",
		role: "Mentorship matching",
		image: "",
		summary: "AI-powered mentor-mentee matching with progress tracking.",
		tags: ["Next.js", "OpenAI", "Postgres"],
	},
	{
		name: "AnimalRescue",
		org: "SavePaws",
		role: "Rescue operations dashboard",
		image: "",
		summary: "Animal intake, medical records, and adoption management.",
		tags: ["React", "Node", "PostgreSQL"],
	},
	{
		name: "CleanWater",
		org: "WaterAid",
		role: "Well maintenance scheduler",
		image: "",
		summary: "Preventive maintenance and repair scheduling for water wells.",
		tags: ["React", "SMS", "Mapbox"],
	},
	{
		name: "TeachTech",
		org: "CodeForChange",
		role: "Coding bootcamp portal",
		image: "",
		summary: "Curriculum delivery, project tracking, and placement dashboard.",
		tags: ["Next.js", "GitHub API", "Postgres"],
	},
	{
		name: "VolunteerLog",
		org: "ServeHub",
		role: "Volunteer hours logging",
		image: "",
		summary: "Simple time tracking and impact reporting for volunteers.",
		tags: ["React", "Supabase", "Tailwind"],
	},
	{
		name: "ChildGuard",
		org: "SafeKids",
		role: "Child welfare case management",
		image: "",
		summary: "Confidential family history, notes, and services coordination.",
		tags: ["Next.js", "Postgres", "Encryption"],
	},
	{
		name: "DisasterAid",
		org: "EmergencyResponse",
		role: "Disaster relief coordinator",
		image: "",
		summary: "Resource allocation and volunteer dispatch during emergencies.",
		tags: ["React", "Firebase", "Maps"],
	},
	{
		name: "AccessHub",
		org: "DisabilityFirst",
		role: "Accessibility audit platform",
		image: "",
		summary: "Website and app accessibility reporting and remediation tracking.",
		tags: ["Next.js", "Puppeteer", "Node"],
	},
	{
		name: "EnergyShare",
		org: "ClimateAction",
		role: "Community solar platform",
		image: "",
		summary: "Solar project investment and benefit-sharing for low-income households.",
		tags: ["React", "Stripe", "Postgres"],
	},
	{
		name: "MindsWell",
		org: "MentalHealthCo",
		role: "Peer support matching",
		image: "",
		summary: "Confidential peer support groups with trained facilitators.",
		tags: ["Next.js", "Supabase", "Auth"],
	},
];

export default function Impact() {
	const wrapperRef = useRef<HTMLElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);
	const prevBtnRef = useRef<HTMLButtonElement>(null);
	const nextBtnRef = useRef<HTMLButtonElement>(null);
	const columns = Math.ceil(projects.length / 2);

	useEffect(() => {
		const track = trackRef.current;
		const prevBtn = prevBtnRef.current;
		const nextBtn = nextBtnRef.current;

		if (!track || !prevBtn || !nextBtn) return;

		// Get the parent container (the relative w-full div)
		const container = track.parentElement;
		if (!container) return;

		// Calculate bounds: allow dragging until all content is visible
		const containerWidth = container.clientWidth;
		const contentWidth = track.scrollWidth;
		const minBound = Math.min(0, containerWidth - contentWidth);

		const drag = Draggable.create(track, {
			type: "x",
			bounds: { minX: minBound, maxX: 0 },
			inertia: true,
			edgeResistance: 0.65,
			throwProps: true,
		})[0];

		// Calculate the width of 2.5 projects (each column + gap)
		// Gap is 24px (gap-6), column width is 25vw approximately
		const columnWidth = containerWidth * 0.25; // 25vw
		const gapSize = 24; // gap-6 in tailwind
		const projectsToScroll = 2.5;
		const scrollDistance = (columnWidth + gapSize) * projectsToScroll;

		// Navigation button handlers
		const handlePrev = () => {
			const currentX = track._gsap?.x || 0;
			// Left arrow: show earlier projects (move towards x=0)
			const newX = Math.min(0, currentX + scrollDistance);
			if (newX === currentX) return; // Already at the start
			
			gsap.to(track, {
				x: newX,
				duration: 0.6,
				ease: "power2.inOut",
			});
		};

		const handleNext = () => {
			const currentX = track._gsap?.x || 0;
			// Right arrow: show later projects (move towards minBound)
			const newX = Math.max(minBound, currentX - scrollDistance);
			if (newX === currentX) return; // Already at the end
			
			gsap.to(track, {
				x: newX,
				duration: 0.6,
				ease: "power2.inOut",
			});
		};

		prevBtn.addEventListener("click", handlePrev);
		nextBtn.addEventListener("click", handleNext);

		return () => {
			drag.kill();
			prevBtn.removeEventListener("click", handlePrev);
			nextBtn.removeEventListener("click", handleNext);
		};
	}, []);

	return (
		<section
			ref={wrapperRef}
			className="min-h-screen bg-[#0F0F10] text-white px-0 overflow-hidden"
		>
			<div className="w-full px-4 pt-8 pb-0">
				<header className="mb-4 text-center">
				<p className="text-xs uppercase tracking-[0.25em]" style={{ color: '#A1A1AA' }}>Impact Gallery</p>
				<p className="mt-2 text-2xl md:text-3xl font-semibold">2025/2026 Project Gallery</p>
			</header>
		</div>

			<div className="relative w-full overflow-hidden">
				<button
					ref={prevBtnRef}
					data-action="prev"
					className="absolute left-4 top-1/2 -translate-y-1/2 z-40 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg p-3 transition-colors"
				>
					<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
					</svg>
				</button>

				<div
					ref={trackRef}
					className="grid grid-rows-2 gap-6 px-6 h-[80vh] cursor-grab"
					style={{
						gridAutoFlow: "column",
						gridAutoColumns: "minmax(220px, 25vw)",
						width: "fit-content",
						willChange: "transform",
					}}
				>
					{projects.map((card) => (
					<ProjectCard key={card.name} card={card} />
				))}
			</div>

				<button
					ref={nextBtnRef}
					data-action="next"
					className="absolute right-4 top-1/2 -translate-y-1/2 z-40 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg p-3 transition-colors"
				>
					<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
					</svg>
				</button>

				{/* Right-edge fade overlay */}
			<div className="absolute right-0 top-0 bottom-0 w-32 z-30 pointer-events-none bg-gradient-to-l from-[#0F0F10] to-transparent" />
			</div>
		</section>
	);
}


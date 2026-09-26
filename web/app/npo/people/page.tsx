"use client";

import SmoothScroll from "@/components/SmoothScroll";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  EASE_ENTER,
  DURATION_SECTION,
  STAGGER_NORMAL,
} from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const leadership = [
  { name: "Sarah Chen", initials: "SC", role: "NPO Program Director", year: "4th Year CS", bio: "Led 3 cohorts and 12 project deliveries. Previously interned at Shopify and founded a coding bootcamp for underrepresented youth." },
  { name: "Marcus Lee", initials: "ML", role: "VP Engineering", year: "4th Year CS", bio: "Architected the technical standards that guide every Tethos project. Open-source contributor and former Google STEP intern." },
  { name: "Priya Sharma", initials: "PS", role: "VP Design", year: "3rd Year CS", bio: "Established Tethos's design system and leads the UX practice across all NPO engagements." },
  { name: "David Kim", initials: "DK", role: "VP Operations", year: "3rd Year CS", bio: "Manages project timelines, client communications, and team logistics across all active cohorts." },
];

const currentTeam = [
  { name: "James Okafor", initials: "JO", role: "Full-Stack Dev", project: "Hearth", year: "3rd Year SE" },
  { name: "Anika Patel", initials: "AP", role: "Frontend Dev", project: "Pathways", year: "2nd Year SE" },
  { name: "Emily Tran", initials: "ET", role: "Data Engineer", project: "Donor Nexus", year: "4th Year DS" },
  { name: "Ryan Costa", initials: "RC", role: "Mobile Dev", project: "Green Routes", year: "3rd Year CS" },
  { name: "Mia Johnson", initials: "MJ", role: "QA Engineer", project: "Hearth", year: "2nd Year CS" },
  { name: "Alex Rivera", initials: "AR", role: "Tech Lead", project: "Grant Glass", year: "4th Year SE" },
  { name: "Zara Williams", initials: "ZW", role: "Designer", project: "Pulse", year: "3rd Year CS" },
  { name: "Noah Park", initials: "NP", role: "Backend Dev", project: "Pathways", year: "2nd Year CS" },
  { name: "Liam Torres", initials: "LT", role: "DevOps", project: "Donor Nexus", year: "3rd Year CS" },
  { name: "Ava Chen", initials: "AC", role: "Frontend Dev", project: "Grant Glass", year: "2nd Year SE" },
  { name: "Ethan Wright", initials: "EW", role: "Full-Stack Dev", project: "Pulse", year: "3rd Year CS" },
  { name: "Sofia Gupta", initials: "SG", role: "Designer", project: "Green Routes", year: "4th Year CS" },
];

const alumni = [
  { name: "Jordan Liu", placement: "Shopify", cohort: "2023" },
  { name: "Maya Patel", placement: "Microsoft", cohort: "2023" },
  { name: "Chris Nguyen", placement: "Google", cohort: "2024" },
  { name: "Isabel Torres", placement: "Stripe", cohort: "2024" },
  { name: "Daniel Park", placement: "Amazon", cohort: "2023" },
  { name: "Samira Hassan", placement: "Meta", cohort: "2024" },
  { name: "Tyler Chen", placement: "Notion", cohort: "2025" },
  { name: "Rachel Kim", placement: "Linear", cohort: "2025" },
];

function PersonCard({
  name,
  initials,
  role,
  detail,
  highlight,
}: {
  name: string;
  initials: string;
  role: string;
  detail: string;
  highlight?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="rounded-2xl p-6 transition-all duration-300"
      style={{
        backgroundColor: hovered ? "#1F1F22" : "#1A1A1C",
        border: highlight && hovered ? "1px solid #002FA7" : "1px solid #2A2A2C",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-4 mb-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300"
          style={{
            backgroundColor: hovered ? "#002FA7" : "#27272A",
          }}
        >
          <span
            className="font-mono text-xs font-bold transition-colors duration-300"
            style={{ color: hovered ? "#F1FFFF" : "#555" }}
          >
            {initials}
          </span>
        </div>
        <div>
          <p className="font-heading text-sm font-semibold">{name}</p>
          <p className="font-mono text-xs" style={{ color: "#555" }}>
            {role}
          </p>
        </div>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: "#888" }}>
        {detail}
      </p>
    </div>
  );
}

export default function PeoplePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (heroRef.current) {
        const children = heroRef.current.querySelectorAll("[data-reveal]");
        gsap.fromTo(
          children,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: DURATION_SECTION,
            stagger: STAGGER_NORMAL,
            ease: EASE_ENTER,
            delay: 0.2,
          }
        );
      }

      sectionsRef.current.forEach((el) => {
        if (!el) return;
        gsap.fromTo(
          el,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: DURATION_SECTION,
            ease: EASE_ENTER,
            scrollTrigger: {
              trigger: el,
              start: "top 80%",
              toggleActions: "play none none none",
            },
          }
        );
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <SmoothScroll>
      <main className="min-h-screen" style={{ backgroundColor: "#0F0F10", color: "#F5F5F5" }}>

        {/* HERO */}
        <section
          data-navbar-theme="dark"
          className="min-h-[90vh] flex items-center justify-center px-6 pt-40 pb-24"
        >
          <div ref={heroRef} className="max-w-4xl mx-auto text-center">
            <p
              data-reveal
              className="font-mono text-xs uppercase tracking-[0.3em] mb-8"
              style={{ color: "#555" }}
            >
              The People
            </p>
            <h1
              data-reveal
              className="font-heading text-5xl md:text-6xl lg:text-7xl font-semibold mb-6 leading-[1.05] tracking-tight"
            >
              Built by Students
              <br />
              <span className="italic font-light" style={{ color: "#888" }}>
                Who Ship.
              </span>
            </h1>
            <p
              data-reveal
              className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
              style={{ color: "#888" }}
            >
              150+ members across 3 university chapters. Meet the team
              building software for social good.
            </p>
          </div>
        </section>

        {/* LEADERSHIP */}
        <section
          data-navbar-theme="dark"
          className="py-32 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div
            ref={(el) => { sectionsRef.current[0] = el; }}
            className="max-w-5xl mx-auto"
            style={{ opacity: 0 }}
          >
            <p className="font-mono text-xs uppercase tracking-[0.3em] mb-4" style={{ color: "#555" }}>
              Leadership
            </p>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold mb-16">
              NPO Program Leads
            </h2>

            <div className="grid sm:grid-cols-2 gap-5">
              {leadership.map((person) => (
                <div
                  key={person.name}
                  className="rounded-2xl p-8"
                  style={{ backgroundColor: "#1A1A1C", border: "1px solid #2A2A2C" }}
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: "#002FA7" }}
                    >
                      <span className="font-mono text-sm font-bold" style={{ color: "#F1FFFF" }}>
                        {person.initials}
                      </span>
                    </div>
                    <div>
                      <p className="font-heading text-lg font-semibold">{person.name}</p>
                      <p className="font-mono text-xs" style={{ color: "#002FA7" }}>
                        {person.role}
                      </p>
                      <p className="font-mono text-xs mt-0.5" style={{ color: "#555" }}>
                        {person.year}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "#888" }}>
                    {person.bio}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CURRENT TEAM */}
        <section
          data-navbar-theme="dark"
          className="py-32 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div
            ref={(el) => { sectionsRef.current[1] = el; }}
            className="max-w-5xl mx-auto"
            style={{ opacity: 0 }}
          >
            <div className="flex items-end justify-between mb-16 flex-wrap gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.3em] mb-4" style={{ color: "#555" }}>
                  2025–2026 Cohort
                </p>
                <h2 className="font-heading text-3xl md:text-4xl font-semibold">
                  Current Team
                </h2>
              </div>
              <p className="font-mono text-xs uppercase tracking-[0.15em]" style={{ color: "#555" }}>
                {currentTeam.length} members
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentTeam.map((person) => (
                <PersonCard
                  key={person.name}
                  name={person.name}
                  initials={person.initials}
                  role={person.role}
                  detail={`${person.year} · Project: ${person.project}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ALUMNI */}
        <section
          data-navbar-theme="dark"
          className="py-32 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div
            ref={(el) => { sectionsRef.current[2] = el; }}
            className="max-w-5xl mx-auto"
            style={{ opacity: 0 }}
          >
            <p className="font-mono text-xs uppercase tracking-[0.3em] mb-4" style={{ color: "#555" }}>
              Where They Go
            </p>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold mb-6">
              Alumni Placements
            </h2>
            <p className="text-base leading-relaxed mb-16 max-w-2xl" style={{ color: "#888" }}>
              85% of Tethos alumni secure positions at top tech companies, startups,
              or graduate programs within 6 months of graduating.
            </p>

            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
              {alumni.map((person) => (
                <div
                  key={person.name}
                  className="rounded-2xl p-6"
                  style={{ backgroundColor: "#1A1A1C", border: "1px solid #2A2A2C" }}
                >
                  <p className="font-heading text-sm font-semibold mb-1">{person.name}</p>
                  <p className="font-mono text-xs mb-2" style={{ color: "#002FA7" }}>
                    → {person.placement}
                  </p>
                  <p className="font-mono text-xs" style={{ color: "#555" }}>
                    Cohort {person.cohort}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section
          data-navbar-theme="dark"
          className="py-40 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div
            ref={(el) => { sectionsRef.current[3] = el; }}
            className="max-w-3xl mx-auto text-center"
            style={{ opacity: 0 }}
          >
            <h2 className="font-heading text-4xl md:text-5xl font-semibold mb-6">
              Join the Team.
            </h2>
            <p className="text-lg mb-12 max-w-xl mx-auto leading-relaxed" style={{ color: "#888" }}>
              We&rsquo;re always looking for driven students who want to build
              software that matters. No prior experience required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/student"
                className="rounded-full px-8 py-4 text-sm font-medium text-white transition-opacity hover:opacity-80 inline-block"
                style={{ backgroundColor: "#002FA7" }}
              >
                Student Applications
              </a>
              <a
                href="/npo/apply"
                className="rounded-full px-8 py-4 text-sm font-medium inline-block transition-opacity hover:opacity-80"
                style={{ border: "1px solid #333", color: "#999" }}
              >
                NPO Applications
              </a>
            </div>
          </div>
        </section>

      </main>
    </SmoothScroll>
  );
}

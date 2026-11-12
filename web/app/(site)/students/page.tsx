import "../pages.css";
import "../home.css";
import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/site/Reveal";
import GlyphSeam from "@/components/site/GlyphSeam";
import DotNav from "@/components/site/DotNav";
import StudentCrowd from "@/components/site/students/StudentCrowd";
import HiringPortal from "@/components/site/students/HiringPortal";
import NpoTimeline, { type TimelineStop } from "@/components/site/npo/NpoTimeline";
import ProjectArchive from "@/components/site/students/ProjectArchive";
import AlumniLogos from "@/components/site/students/AlumniLogos";
import { ALUMNI_COMPANIES, PROJECT_YEARS } from "@/lib/site/projects";
import { TETHOS } from "@/lib/site/config";
import { loadSeasonCta } from "@/lib/site/season-server";

export const metadata: Metadata = {
  title: "Students",
  description: "Join Tech for Social Impact: student teams build software for nonprofits from October to April and show it at GENESIS in March.",
};

const APPLY = "/student/apply";

/** A member's year, August to May, from the club's own calendar (the cottage trip, hiring, the build, GENESIS, exec hiring). */
const YEAR_MONTHS = {
  short: ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"],
  long: ["AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER", "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY"],
};
const YEAR: TimelineStop[] = [
  { at: 0, when: "Aug", title: "Cottage trip", detail: "A weekend away in late August to meet the team before the year starts." },
  { at: 1.3, when: "Sep", title: "Hiring", detail: "Roles open Sep 10 for about two weeks: developers, project managers and directors." },
  { at: 2, when: "Oct", title: "Final round", detail: "In person, with the team, in early October. You hear back the same month." },
  { at: 2.6, until: 7, when: "Oct–Mar", title: "Build", detail: "Your team meets its nonprofit and agrees on what to build, then designs and codes it with a demo every two weeks." },
  { at: 4, when: "Monthly", title: "Town halls", detail: "The whole club meets every month, often with a social after." },
  { at: 7, when: "Mar", title: "GENESIS", detail: "Every team shows what it built to its nonprofit, the sponsors and 350+ guests." },
  { at: 8, when: "Apr", title: "Handoff", detail: "Your team hands the software, its code and its docs to the nonprofit." },
  { at: 9, when: "May", title: "Next year's team", detail: "The executive team for next year is hired, and the cycle starts again." },
];

/** How a September round runs, from the applicant portal's stages (screening, interview, final review). */
const STEPS = [
  { when: "September", step: "Apply", line: "Roles open in the applicant portal for about two weeks." },
  { when: "After you apply", step: "Interview", line: "If you're shortlisted, your invite comes through the portal." },
  { when: "Early October", step: "Final round", line: "In person, with the team." },
  { when: "October", step: "Decision", line: "You hear back in the portal." },
  { when: "October to April", step: "Build", line: "Your team builds for its nonprofit, then shows it at GENESIS in March." },
];

/** The club outside the projects, from the club's own photos. Each caption says only what its photo shows. */
const LIFE: { title: string; line: string; img: string; alt: string; size: "wide" | "tall" }[] = [
  { title: "Cottage trip", line: "A weekend away in late August to meet the team before the year starts.", img: "/images/site/students/cottage-dinner.webp", alt: "TSI members at dinner on a cottage deck", size: "wide" },
  { title: "On the water", line: "Kayaking at the cottage.", img: "/images/site/students/cottage-kayak.webp", alt: "Two members in an inflatable kayak on a lake, seen from the shore", size: "tall" },
  { title: "Skating", line: "A March social on the rink, then Korean barbecue.", img: "/images/site/students/skating.webp", alt: "A group of members in winter coats on an outdoor rink", size: "tall" },
  { title: "Town halls", line: "The whole club meets every month, often with a social after.", img: "/images/site/students/town-hall.webp", alt: "Members in TSI hoodies with their arms up in a courtyard", size: "tall" },
  { title: "GENESIS", line: "Every team demos what it built, in March.", img: "/images/site/students/genesis-hearts.webp", alt: "Members making heart hands at GENESIS", size: "tall" },
  { title: "Arcade night", line: "A night out in March.", img: "/images/site/students/arcade.webp", alt: "A group of members posing in an arcade", size: "tall" },
  { title: "Volunteering", line: "Making sandwiches for ArkAid.", img: "/images/site/students/sandwiches.webp", alt: "Members in a kitchen behind bins of sandwiches", size: "tall" },
  { title: "Tethos Island", line: "The club's own game, for members, at play.tethos.ca.", img: "/images/site/tethos-island.webp", alt: "Tethos Island, the member world: a small island with the club's buildings", size: "tall" },
];

const CHAPTER_MAIL = `mailto:${TETHOS.contact}?subject=${encodeURIComponent("Starting a TSI chapter")}`;

const SECTIONS = [
  { id: "students", label: "Students" },
  { id: "year", label: "A year at TSI" },
  { id: "projects", label: "Projects" },
  { id: "alumni", label: "Where members worked" },
  { id: "hiring", label: "Hiring" },
  { id: "life", label: "Outside the projects" },
  { id: "portal", label: "Portal opens" },
  { id: "chapter", label: "Start a chapter" },
];

export default async function StudentsPage() {
  const open = (await loadSeasonCta()).kind === "students";
  return (
    <>
      <DotNav sections={SECTIONS} />
      <section className="ts-section st-hero" data-tone="dark" id="students" aria-labelledby="students-title">
        <div className="ts-wrap st-hero__grid">
          <div className="st-hero__copy">
            <Reveal delay={0.06}><h1 className="ts-h1 st-hero__title" id="students-title">Build software a nonprofit will use.</h1></Reveal>
            <Reveal delay={0.12}>
              <p className="ts-lede">TSI is 150+ students at Western and UBC. Each year our teams of developers, designers and project managers build for a nonprofit from October to April, then show it at GENESIS in March.</p>
            </Reveal>
            <Reveal delay={0.18} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href={APPLY} className="ts-btn ts-btn--primary">See open roles <span className="ts-btn__arrow">→</span></Link>
            </Reveal>
          </div>
          <div className="st-hero__crowd">
            <StudentCrowd />
          </div>
        </div>
      </section>

      <NpoTimeline id="year" title="A year at TSI." stops={YEAR} months={YEAR_MONTHS} />

      <GlyphSeam from="dark" to="light" seed={36} />
      <ProjectArchive years={PROJECT_YEARS} />
      <GlyphSeam from="light" to="dark" seed={37} />
      <AlumniLogos companies={ALUMNI_COMPANIES} />

      <section className="ts-section" data-tone="dark" id="hiring" aria-labelledby="hiring-title">
        <div className="ts-wrap">
          <div className="st-hiring__head">
            <Reveal delay={0.06}><h2 className="ts-h2" id="hiring-title">How hiring works.</h2></Reveal>
            {open && <Reveal delay={0.1}><Link href={APPLY} className="st-open"><i aria-hidden="true" />Applications are open now</Link></Reveal>}
          </div>
          <ol className="st-steps">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.step} className="st-step" delay={0.06 * i}>
                <span className="st-step__dot" aria-hidden="true" />
                <span className="st-step__when">{s.when}</span>
                <h3 className="ts-h3">{s.step}</h3>
                <p className="ts-body">{s.line}</p>
              </Reveal>
            ))}
          </ol>
          <Reveal delay={0.1}>
            <p className="ts-body st-hiring__note">Next year&apos;s executive team is hired in May, the same way. <Link href={APPLY}>See open roles <span aria-hidden="true">→</span></Link></p>
          </Reveal>
        </div>
      </section>

      <GlyphSeam from="dark" to="light" seed={34} />
      <section className="ts-section" data-tone="light" id="life" aria-labelledby="life-title">
        <div className="ts-wrap">
          <div className="st-life__head">
            <Reveal delay={0.06}><h2 className="ts-h2" id="life-title">Outside the projects.</h2></Reveal>
            <Reveal delay={0.1}><a href={TETHOS.instagram} target="_blank" rel="noopener noreferrer" className="ts-btn ts-btn--ghost">Follow on Instagram <span aria-hidden="true">↗</span></a></Reveal>
          </div>
          <ul className="st-life">
            {LIFE.map((t, i) => (
              <Reveal as="li" key={t.title} className={`st-tile st-tile--${t.size}`} delay={0.05 * (i % 3)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.img} alt={t.alt} loading="lazy" />
                <div className="st-tile__cap"><b>{t.title}</b><span>{t.line}</span></div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <GlyphSeam from="light" to="dark" seed={35} />
      <HiringPortal open={open} />
      <section className="ts-section cl" data-tone="dark" id="chapter" aria-labelledby="chapter-title">
        <div className="ts-wrap st-chapter">
          <Reveal delay={0.06}><h2 className="cl__title st-chapter__title" id="chapter-title">Start a chapter at your school.</h2></Reveal>
          <Reveal delay={0.12}>
            <p className="ts-lede" style={{ textAlign: "center", margin: "0 auto", maxWidth: "34em" }}>TSI started at Western and has a chapter at UBC. If you want one on your campus, email us and tell us about your school.</p>
          </Reveal>
          <Reveal delay={0.18} style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <a href={CHAPTER_MAIL} className="ts-btn ts-btn--primary">Email {TETHOS.contact} <span className="ts-btn__arrow">→</span></a>
            <Link href={APPLY} className="ts-btn ts-btn--ghost">See open roles</Link>
          </Reveal>
        </div>
      </section>
      <GlyphSeam from="dark" to="light" seed={33} />
    </>
  );
}

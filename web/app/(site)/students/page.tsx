import "../pages.css";
import "../home.css";
import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/site/Reveal";
import GlyphSeam from "@/components/site/GlyphSeam";
import DotNav from "@/components/site/DotNav";
import StudentCrowd from "@/components/site/students/StudentCrowd";
import { Person } from "@/components/site/marks";
import { TETHOS } from "@/lib/site/config";
import { loadSeasonCta } from "@/lib/site/season-server";

export const metadata: Metadata = {
  title: "Students",
  description: "Join Tech for Social Impact: student teams build software for nonprofits from October to April and show it at GENESIS in March.",
};

const APPLY = "/student/apply";

/** The roles, from the live positions and the year on the home page. */
const ROLES = [
  { role: "Developer", line: "Build useful software with a project team for a nonprofit client.", when: "September", people: 3 },
  { role: "Project manager", line: "Lead a project team and work with its nonprofit from October to April.", when: "September", people: 1 },
  { role: "Director", line: "Marketing, internal or external: make the work visible, keep the team connected, or build ties with partners and sponsors.", when: "September", people: 2 },
  { role: "Leadership", line: "Run the club as next year's executive team.", when: "May", people: 4 },
];

/** How a September round runs, from the applicant portal's stages (screening, interview, final review). */
const STEPS = [
  { when: "September", step: "Apply", line: "Roles open in the applicant portal for about two weeks." },
  { when: "After you apply", step: "Interview", line: "If you're shortlisted, your invite comes through the portal." },
  { when: "Early October", step: "Final round", line: "In person, with the team." },
  { when: "October", step: "Decision", line: "You hear back in the portal." },
  { when: "October to April", step: "Build", line: "Your team builds for its nonprofit, then shows it at GENESIS in March." },
];

/** The club outside the projects. Photo tiles say only what the photo shows. */
const LIFE: { title: string; line: string; img?: string; alt?: string; size: "wide" | "tall" | "small" }[] = [
  { title: "Cottage trip", line: "A weekend away in late August to meet the team before the year starts.", size: "small" },
  { title: "This year's team", line: "Together outside, in TSI hoodies.", img: "/images/site/tsi-team-2026.webp", alt: "The 2026–27 TSI team in navy TSI hoodies, gathered outside behind a TSI banner", size: "wide" },
  { title: "Townhalls", line: "The whole club meets every month, often with a social after.", size: "small" },
  { title: "Volunteering", line: "With Common Grounds we made 344 sandwiches for Arc Aid.", img: "/images/site/tsi-common-grounds.webp", alt: "TSI members in a kitchen behind three bins of sandwiches made for Arc Aid", size: "tall" },
  { title: "GENESIS", line: "Every team demos what it built, in March.", img: "/images/site/genesis-presenting.webp", alt: "Students presenting to a crowd at GENESIS 2026", size: "tall" },
  { title: "Tethos Island", line: "The club's own game, for members, at play.tethos.ca.", img: "/images/site/tethos-island.webp", alt: "Tethos Island, the member world: a small island with the club's buildings", size: "tall" },
];

const CHAPTER_MAIL = `mailto:${TETHOS.contact}?subject=${encodeURIComponent("Starting a TSI chapter")}`;

const SECTIONS = [
  { id: "students", label: "Students" },
  { id: "roles", label: "Roles" },
  { id: "hiring", label: "Hiring" },
  { id: "life", label: "Outside the projects" },
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
              <a href="#roles" className="ts-btn ts-btn--ghost">Pick a role</a>
            </Reveal>
          </div>
          <div className="st-hero__crowd">
            <StudentCrowd />
          </div>
        </div>
      </section>

      <GlyphSeam from="dark" to="light" seed={31} />
      <section className="ts-section" data-tone="light" id="roles" aria-labelledby="roles-title">
        <div className="ts-wrap">
          <Reveal delay={0.06}><h2 className="ts-h2" id="roles-title">Pick a role.</h2></Reveal>
          <ul className="st-roles">
            {ROLES.map((r, i) => (
              <Reveal as="li" key={r.role} className="st-role" delay={0.06 * i}>
                <div className="st-role__card">
                  <span className="st-role__people" aria-hidden="true">
                    {Array.from({ length: r.people }, (_, k) => <Person key={k} className="st-role__person" />)}
                  </span>
                  <h3 className="ts-h3">{r.role}</h3>
                  <p className="ts-body">{r.line}</p>
                  <p className="st-role__when">Hiring in {r.when}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <GlyphSeam from="light" to="dark" seed={32} />
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
              <Reveal as="li" key={t.title} className={`st-tile st-tile--${t.size}${t.img ? "" : " st-tile--text"}`} delay={0.05 * (i % 3)}>
                {t.img ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.img} alt={t.alt} loading="lazy" />
                    <div className="st-tile__cap"><b>{t.title}</b><span>{t.line}</span></div>
                  </>
                ) : (
                  <>
                    <span className="st-tile__people" aria-hidden="true">{Array.from({ length: 5 }, (_, k) => <Person key={k} className="st-tile__person" />)}</span>
                    <h3 className="ts-h3">{t.title}</h3>
                    <p className="ts-body">{t.line}</p>
                  </>
                )}
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <GlyphSeam from="light" to="dark" seed={35} />
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

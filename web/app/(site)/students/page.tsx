import "../pages.css";
import "../home.css";
import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/site/Reveal";
import GlyphSeam from "@/components/site/GlyphSeam";
import DotNav from "@/components/site/DotNav";
import StudentCrowd from "@/components/site/students/StudentCrowd";
import { Person } from "@/components/site/marks";
import { PLAY_ORIGIN } from "@/lib/hosts";

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

const SECTIONS = [
  { id: "students", label: "Students" },
  { id: "roles", label: "Roles" },
  { id: "island", label: "The island" },
];

export default function StudentsPage() {
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
      <section className="ts-section" data-tone="dark" id="island" aria-labelledby="island-title">
        <div className="ts-wrap">
          <div className="tm-window-row st-island">
            <div style={{ display: "grid", gap: 18 }}>
              <Reveal delay={0.06}><h2 className="ts-h2" id="island-title">Members get an island.</h2></Reveal>
              <Reveal delay={0.12}>
                <p className="ts-body">Tethos Island is our member world at play.tethos.ca. Fish, play beach volleyball, fix up your home and take on the club&apos;s quests with everyone else.</p>
              </Reveal>
              <Reveal delay={0.16}><a href={`${PLAY_ORIGIN}/`} className="ts-btn ts-btn--ghost">Member sign-in</a></Reveal>
            </div>
            <Reveal className="tm-window">
              <div className="tm-window__bar"><span className="tm-window__dots"><i /><i /><i /></span>play.tethos.ca</div>
              <div className="tm-window__screen">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/site/tethos-island.webp" alt="Tethos Island, the member world: a small island with the club's buildings" loading="lazy" />
              </div>
            </Reveal>
          </div>

          <div className="st-join">
            <Reveal delay={0.06}><h2 className="cl__title">Build with us.</h2></Reveal>
            <Reveal delay={0.12}>
              <p className="ts-lede" style={{ textAlign: "center", margin: "0 auto" }}>Hiring runs in September for developers, project managers and directors, and in May for next year&apos;s leadership.</p>
            </Reveal>
            <Reveal delay={0.18}><Link href={APPLY} className="ts-btn ts-btn--primary">See open roles <span className="ts-btn__arrow">→</span></Link></Reveal>
          </div>
        </div>
      </section>
      <GlyphSeam from="dark" to="light" seed={33} />
    </>
  );
}

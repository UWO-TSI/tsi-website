import "../pages.css";
import type { Metadata } from "next";
import GlyphField from "@/components/site/GlyphField";
import Reveal from "@/components/site/Reveal";
import DotNav from "@/components/site/DotNav";
import GlyphSeam from "@/components/site/GlyphSeam";
import SponsorForm from "@/components/site/genesis/SponsorForm";
import { Person } from "@/components/site/marks";
import { GENESIS_2026 } from "@/lib/site/config";
import { DEVELOPER_PROJECTS } from "@/lib/recruitment-projects";
import { GENESIS_FIELD, GENESIS_PHRASE } from "@/components/site/home/GenesisHome";

export const metadata: Metadata = {
  title: "GENESIS",
  description: "GENESIS is Tethos's year-end showcase. Every March, student teams present the software they built for nonprofits. Sponsor it.",
};

/** One line per project, from David's descriptions in lib/recruitment-projects.ts. */
const PROJECT_LINES: Record<string, string> = {
  "MAP Program App": "One app for My Action Plan to Education: registration, each student's plan, tutoring bookings and progress toward scholarships.",
  "Kitchen Dashboard": "Meals served, what's in them and what's on hand at 696 Dundas, logged by whoever is on shift.",
  "Carbon and Energy Dashboard": "Replaces an emissions spreadsheet and turns the building's live energy data into something staff can act on.",
  "Walk Support Hub": "Registration, donations, volunteers and point of sale for the Brain Tumour Walk, live on walk day.",
  "Dietary Restriction System": "Tells chefs what each child can't eat and what to substitute, instead of a 30 to 60 minute read every morning.",
};

const FLOW = [
  { who: "You", line: "Fund the year.", people: 1 },
  { who: "Student teams", line: "Developers, designers and project managers, matched to a project.", people: 3 },
  { who: "Nonprofits", line: "Get software they couldn't otherwise pay for.", people: 2 },
  { who: "GENESIS", line: "Everyone in one room in March: the teams, the nonprofits and you.", people: 6 },
];

/** GENESIS 2026 in photos (the same shots as the home page's team section). */
const GLANCE = [
  { src: "/images/site/genesis-presenting.webp", line: "Presenting to the room.", alt: "Students presenting to a crowd at GENESIS 2026" },
  { src: "/images/site/genesis-banner.webp", line: "The team behind the Western 2025–2026 TSI banner.", alt: "The TSI team at GENESIS 2026 behind the Western 2025–2026 TSI banner" },
  { src: "/images/site/genesis-spacewalk.webp", line: "A project team at their exhibit.", alt: "A project team in TSI hoodies around their exhibit at GENESIS 2026" },
  { src: "/images/site/genesis-redcross.webp", line: "The Canadian Red Cross project table.", alt: "A project team at their Canadian Red Cross table at GENESIS 2026" },
];

/** GENESIS 2026's sponsors, in the strip as their logos (public/logos/sponsors, from each sponsor's own site). */
/** `scale` evens out how big each mark looks: wide wordmarks sit smaller, compact badges larger. */
const THANKS: { name: string; logo?: string; scale?: number }[] = [
  { name: "Plan Catalyst", logo: "/logos/sponsors/plan-catalyst.png", scale: 0.62 },
  { name: "McGregor Allsop", logo: "/logos/sponsors/mcgregor-allsop.png", scale: 0.8 },
  { name: "Entrepreneurship at Western", logo: "/logos/sponsors/entrepreneurship-western.svg" },
  { name: "uBit Foundation", logo: "/logos/sponsors/ubit.png" },
  { name: "Plaza Sushi", logo: "/logos/sponsors/plaza-sushi.png", scale: 1.1 },
  { name: "Frank and Furters", logo: "/logos/sponsors/frank-and-furters.png", scale: 0.9 },
];

const SECTIONS = [
  { id: "genesis-hero", label: "GENESIS" },
  { id: "projects", label: "Projects" },
  { id: "where", label: "Where it goes" },
  { id: "glance", label: "2026" },
  { id: "thanks", label: "Thank you" },
  { id: "sponsor", label: "Sponsor us" },
];

export default function GenesisPage() {
  return (
    <div className="gx" data-tone="deep">
      <DotNav sections={SECTIONS} />
      <section className="ts-section gx-hero" data-tone="deep" id="genesis-hero">
        <div className="gx-aura" aria-hidden="true" />
        <div className="gx-hero__field" aria-hidden="true">
          <GlyphField src="/images/site/genesis-sphere.png" phrase={GENESIS_PHRASE} backgroundPhrase={GENESIS_FIELD} layout="right" pixelCells avoid=".gx-hero__copy" />
        </div>
        <div className="ts-wrap gx-hero__grid">
          <div className="gx-hero__copy">
            <Reveal delay={0.06}><h1 className="ts-h1 ts-hero-title">GENESIS</h1></Reveal>
            <Reveal delay={0.12}><p className="ts-lede">Every March, student teams present the software they built for nonprofits to the organizations, sponsors and students behind it.</p></Reveal>
            <Reveal delay={0.18}>
              <dl className="gx-stats">
                {GENESIS_2026.map((s) => (
                  <div key={s.label}><dt className="ts-label">{s.label}</dt><dd className="ts-num">{s.value}</dd></div>
                ))}
              </dl>
              <p className="ts-dim gx-stats__note">GENESIS 2026</p>
            </Reveal>
            <Reveal delay={0.24} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="#sponsor" className="ts-btn ts-btn--primary">Sponsor us <span className="ts-btn__arrow">→</span></a>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="ts-section" data-tone="deep" id="projects" aria-labelledby="projects-title">
        <div className="ts-wrap">
          <Reveal delay={0.06}><h2 className="ts-h2" id="projects-title" style={{ maxWidth: "14em" }}>This year&apos;s projects.</h2></Reveal>
          <ol className="gx-projects">
            {DEVELOPER_PROJECTS.map((p, i) => (
              <Reveal as="li" key={p.title} className="gx-project" delay={0.05 * i}>
                <span className="gx-project__logo" style={{ WebkitMaskImage: `url(${p.logo})`, maskImage: `url(${p.logo})` }} role="img" aria-label={p.partner} />
                <span className="gx-project__partner">{p.partner}</span>
                <h3 className="ts-h3">{p.title}</h3>
                <p className="ts-body">{PROJECT_LINES[p.title]}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="ts-section" data-tone="deep" id="where" aria-labelledby="where-title">
        <div className="ts-wrap">
          <Reveal delay={0.06}><h2 className="ts-h2" id="where-title" style={{ maxWidth: "15em" }}>From your support to software in use.</h2></Reveal>
          <ol className="gx-flow">
            {FLOW.map((f, i) => (
              <Reveal as="li" key={f.who} className="gx-flow__step" delay={0.08 * i}>
                <div className="gx-flow__people" aria-hidden="true">
                  {Array.from({ length: f.people }, (_, k) => <Person key={k} className="gx-flow__person" />)}
                </div>
                <h3 className="ts-h3">{f.who}</h3>
                <p className="ts-body">{f.line}</p>
                {i < FLOW.length - 1 && <span className="gx-flow__arrow" aria-hidden="true">→</span>}
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="ts-section" data-tone="deep" id="glance" aria-labelledby="glance-title">
        <div className="ts-wrap">
          <Reveal delay={0.06}><h2 className="ts-h2" id="glance-title">GENESIS 2026 at a glance.</h2></Reveal>
          <Reveal delay={0.1}>
            <dl className="gx-glance__stats">
              {GENESIS_2026.map((s) => (
                <div key={s.label}><dt className="ts-label">{s.label}</dt><dd className="ts-num">{s.value}</dd></div>
              ))}
            </dl>
          </Reveal>
          <div className="gx-glance__photos">
            {GLANCE.map((ph, i) => (
              <Reveal as="figure" key={ph.src} className="gx-glance__photo" delay={0.06 * i} style={{ margin: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.src} alt={ph.alt} loading="lazy" />
                <figcaption>{ph.line}</figcaption>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="gx-thanks" data-tone="deep" id="thanks" aria-labelledby="thanks-title">
        <div className="ts-wrap">
          <p className="ts-body gx-thanks__title" id="thanks-title">Thank you for making GENESIS 2026 happen.</p>
        </div>
        <div className="gx-thanks__strip">
          <div className="gx-thanks__track">
            {[...THANKS, ...THANKS].map((t, i) => (
              <span key={i} className="gx-thanks__item" style={t.scale ? ({ "--s": t.scale } as React.CSSProperties) : undefined} aria-hidden={i >= THANKS.length || undefined}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {t.logo ? <img src={t.logo} alt={t.name} title={t.name} loading="lazy" /> : t.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <GlyphSeam from="deep" to="light" seed={21} />
      <section className="ts-section" data-tone="light" id="sponsor" aria-labelledby="sponsor-title">
        <div className="ts-wrap np-apply">
          <div className="np-apply__intro">
            <h2 className="ts-h2" id="sponsor-title">Sponsor GENESIS 2027.</h2>
            <p className="ts-body" style={{ marginTop: 18 }}>Leave a few details. Judy Gao and Sierra Lin, who run sponsorship, will get back to you.</p>
          </div>
          <SponsorForm />
        </div>
      </section>
    </div>
  );
}

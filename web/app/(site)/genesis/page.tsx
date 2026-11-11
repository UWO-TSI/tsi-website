import "../pages.css";
import type { Metadata } from "next";
import GlyphField from "@/components/site/GlyphField";
import Reveal from "@/components/site/Reveal";
import DotNav from "@/components/site/DotNav";
import { Person } from "@/components/site/marks";
import { GENESIS_2026 } from "@/lib/site/config";
import { DEVELOPER_PROJECTS } from "@/lib/recruitment-projects";

export const metadata: Metadata = {
  title: "GENESIS",
  description: "GENESIS is Tethos's year-end showcase. Every March, student teams present the software they built for nonprofits. Sponsor it.",
};

const PACKAGE = "/genesis-2026-sponsorship-package.pdf";
const SPONSOR_CONTACT = "mailto:jgao537@uwo.ca,slin542@uwo.ca?subject=Sponsoring%20GENESIS";

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

const TIERS = ["Silver", "Gold", "Platinum", "Catalyst"] as const;
const TIER_LABEL = { Silver: "Community", Gold: "Growth", Platinum: "Leadership", Catalyst: "Partnership" } as const;
const PERKS: { perk: string; from: (typeof TIERS)[number]; value?: Partial<Record<(typeof TIERS)[number], string>> }[] = [
  { perk: "Logo on the website and materials", from: "Silver" },
  { perk: "Social media shoutout", from: "Silver" },
  { perk: "Mention in the program booklet", from: "Silver" },
  { perk: "Event access", from: "Silver", value: { Silver: "2 reps", Gold: "4 reps", Platinum: "6 reps", Catalyst: "6 reps" } },
  { perk: "Speaking slot at GENESIS", from: "Gold" },
  { perk: "Quarterly impact report", from: "Gold" },
  { perk: "Talent pipeline access", from: "Platinum" },
  { perk: "Branded workshop or panel", from: "Platinum" },
  { perk: "Named partnership", from: "Catalyst" },
  { perk: "Quarterly leadership review", from: "Catalyst" },
  { perk: "Featured in all materials", from: "Catalyst" },
];

const THANKS = ["Plan Catalyst", "McGregor Allsop", "Entrepreneurship at Western", "uBit Foundation", "Plaza Sushi", "Frank and Furters"];

const SECTIONS = [
  { id: "genesis-hero", label: "GENESIS" },
  { id: "projects", label: "Projects" },
  { id: "where", label: "Where it goes" },
  { id: "sponsor", label: "Tiers" },
  { id: "thanks", label: "Thank you" },
];

export default function GenesisPage() {
  return (
    <div className="gx" data-tone="deep">
      <DotNav sections={SECTIONS} />
      <section className="ts-section gx-hero" data-tone="deep" id="genesis-hero">
        <div className="gx-aura" aria-hidden="true" />
        <div className="ts-wrap gx-hero__grid">
          <div className="gx-hero__copy">
            <Reveal><p className="ts-label">Tethos · Year-end showcase · March</p></Reveal>
            <Reveal delay={0.06}><h1 className="gx-word">GENESIS</h1></Reveal>
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
              <a href="#sponsor" className="ts-btn ts-btn--primary">Sponsor GENESIS <span className="ts-btn__arrow">→</span></a>
              <a href={PACKAGE} className="ts-btn ts-btn--ghost">Sponsorship package (PDF)</a>
            </Reveal>
          </div>
          <div className="gx-hero__field">
            <GlyphField src="/images/site/genesis-hand.png" phrase="GENESIS " />
          </div>
        </div>
      </section>

      <section className="ts-section" data-tone="deep" id="projects" aria-labelledby="projects-title">
        <div className="ts-wrap">
          <Reveal><p className="ts-label">On stage in March</p></Reveal>
          <Reveal delay={0.06}><h2 className="ts-h2" id="projects-title" style={{ marginTop: 18, maxWidth: "14em" }}>This year&apos;s projects.</h2></Reveal>
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
          <Reveal><p className="ts-label">Where your sponsorship goes</p></Reveal>
          <Reveal delay={0.06}><h2 className="ts-h2" id="where-title" style={{ marginTop: 18, maxWidth: "15em" }}>From your support to software in use.</h2></Reveal>
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

      <section className="ts-section" data-tone="deep" id="sponsor" aria-labelledby="sponsor-title">
        <div className="ts-wrap">
          <Reveal><p className="ts-label">Sponsorship tiers</p></Reveal>
          <Reveal delay={0.06}><h2 className="ts-h2" id="sponsor-title" style={{ marginTop: 18, maxWidth: "12em" }}>Fund technology that matters.</h2></Reveal>
          <Reveal className="gx-table-wrap" delay={0.1}>
            <table className="gx-table">
              <caption className="sr-only">What each sponsorship tier includes</caption>
              <thead>
                <tr>
                  <th scope="col"><span className="ts-label">Included</span></th>
                  {TIERS.map((t) => (
                    <th key={t} scope="col" data-featured={t === "Catalyst"}>
                      <span className="gx-table__tier">{t}</span>
                      <span className="gx-table__label">{TIER_LABEL[t]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERKS.map((p) => (
                  <tr key={p.perk}>
                    <th scope="row">{p.perk}</th>
                    {TIERS.map((t) => {
                      const has = TIERS.indexOf(t) >= TIERS.indexOf(p.from);
                      return (
                        <td key={t} data-featured={t === "Catalyst"}>
                          {has ? (p.value?.[t] ?? <span className="gx-table__yes" aria-label="Included">●</span>) : <span className="gx-table__no" aria-label="Not included">–</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
          <Reveal className="gx-cta" delay={0.12}>
            <p className="ts-body">Prices are in the package. Talk to Judy Gao and Sierra Lin, who run sponsorship.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href={SPONSOR_CONTACT} className="ts-btn ts-btn--primary">Talk to us <span className="ts-btn__arrow">→</span></a>
              <a href={PACKAGE} className="ts-btn ts-btn--ghost">Sponsorship package (PDF)</a>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="gx-thanks" data-tone="deep" id="thanks" aria-labelledby="thanks-title">
        <div className="ts-wrap">
          <p className="ts-label" id="thanks-title">Thank you for making GENESIS 2026 happen</p>
        </div>
        <div className="gx-thanks__strip">
          <div className="gx-thanks__track">
            {[...THANKS, ...THANKS].map((n, i) => <span key={i} aria-hidden={i >= THANKS.length}>{n}</span>)}
          </div>
        </div>
      </section>
    </div>
  );
}

import Link from "next/link";
import GlyphField from "@/components/site/GlyphField";
import Reveal from "@/components/site/Reveal";

export const SPONSOR_GETS = [
  { title: "Your name on the work", line: "Your logo on the site, at GENESIS and in everything printed for it." },
  { title: "Meet the students", line: "The developers and designers behind each project, for internships, co-ops and full-time roles." },
  { title: "See where it went", line: "A report on what your support paid for, project by project." },
  { title: "A seat at GENESIS", line: "Bring your team, speak, or run a workshop at the showcase." },
];

export default function GenesisHome() {
  return (
    <section className="ts-section" data-tone="deep" id="genesis" aria-labelledby="genesis-title" style={{ paddingBlock: 0 }}>
      <div className="ts-wrap gn-grid">
        <div className="gn-copy">
          <Reveal><p className="ts-label">GENESIS · March</p></Reveal>
          <Reveal delay={0.08}><h2 className="ts-h2" id="genesis-title" style={{ maxWidth: "12em" }}>Every project ends on one stage.</h2></Reveal>
          <Reveal delay={0.14}><p className="ts-lede">GENESIS is our year-end showcase. Student teams present what they built to the nonprofits they built it for, and to the sponsors who made it possible.</p></Reveal>
          <ol className="gn-list">
            {SPONSOR_GETS.map((s, i) => (
              <Reveal as="li" key={s.title} className="gn-item" delay={0.05 * i}>
                <span className="gn-item__num">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="ts-h3">{s.title}</h3>
                  <p className="ts-body">{s.line}</p>
                </div>
              </Reveal>
            ))}
          </ol>
          <Reveal>
            <Link href="/genesis" className="ts-btn ts-btn--primary" style={{ marginTop: 8 }}>Sponsor GENESIS <span className="ts-btn__arrow">→</span></Link>
          </Reveal>
        </div>
        <div className="gn-field">
          <div className="gn-field__frame">
            <GlyphField src="/images/site/genesis-hand.png" phrase="GENESIS " />
          </div>
        </div>
      </div>
    </section>
  );
}

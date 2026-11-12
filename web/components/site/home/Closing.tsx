import Link from "next/link";
import Reveal from "@/components/site/Reveal";

const PATHS = [
  { who: "Nonprofits", go: "Apply for a build", href: "/npo#apply" },
  { who: "Sponsors", go: "Sponsor GENESIS", href: "/genesis#sponsor" },
  { who: "Students", go: "Find your role", href: "/students" },
];

/** The last call, one way in for each audience: the page's one white section, at the end (David cut the closing globe and its circle). */
export default function Closing() {
  return (
    <section className="ts-section cl" data-tone="light" id="join" aria-labelledby="join-title">
      <div className="ts-wrap cl__inner">
        <Reveal delay={0.06}><h2 className="cl__title" id="join-title">Build with us.</h2></Reveal>
        <Reveal delay={0.12}>
          <p className="ts-lede" style={{ textAlign: "center", margin: "0 auto" }}>
            Nonprofit applications open Aug 10 and student hiring runs in September. GENESIS, where sponsors meet the teams, is in March.
          </p>
        </Reveal>
        <div className="cl__paths">
          {PATHS.map((p, i) => (
            <Reveal key={p.who} delay={0.18 + i * 0.06} className="cl__path">
              <span className="cl__who">{p.who}</span>
              <Link href={p.href} className="ts-btn ts-btn--primary">{p.go} <span className="ts-btn__arrow">→</span></Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

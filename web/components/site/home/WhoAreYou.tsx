import Reveal from "@/components/site/Reveal";

const CARDS = [
  { who: "Nonprofits", line: "Apply for an 8-month build with a student team. It costs your organization nothing.", go: "See the program", href: "/npo" },
  { who: "Sponsors", line: "Back the students and their projects, and meet them at GENESIS in March.", go: "Sponsor GENESIS", href: "/genesis" },
  { who: "Students", line: "Join a team and ship software people use. Hiring runs in September and May.", go: "Find your role", href: "/students" },
];

export default function WhoAreYou() {
  return (
    <section className="ts-section" data-tone="dark" id="audiences" aria-labelledby="audiences-title">
      <div className="ts-wrap">
        <Reveal delay={0.08}><h2 className="ts-h2" id="audiences-title" style={{ maxWidth: "16em" }}>Three ways in, depending on who you are.</h2></Reveal>
        <div className="wy-grid">
          {CARDS.map((c, i) => (
            <Reveal key={c.who} href={c.href} delay={0.1 + i * 0.1} className="wy-card">
              <span className="wy-card__num">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="ts-h3">{c.who}</h3>
              <p className="wy-card__body">{c.line}</p>
              <span className="wy-card__go">{c.go} <span>→</span></span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

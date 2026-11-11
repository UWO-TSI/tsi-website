import Link from "next/link";
import Reveal from "@/components/site/Reveal";
import { PLAY_ORIGIN } from "@/lib/hosts";

/** Hovering a photo shows what it is. */
const PHOTOS = [
  { src: "/images/site/tsi-team-2026.webp", size: "lead", title: "TSI team, 2026–27", line: "This year's members, together outside.", alt: "The 2026–27 TSI team in navy TSI hoodies, gathered outside behind a TSI banner" },
  { src: "/images/site/tsi-common-grounds.webp", size: "side", title: "TSI × Common Grounds", line: "We made sandwiches to donate to Arc Aid. Our team made 344.", alt: "TSI members in a kitchen behind three bins of sandwiches made for Arc Aid" },
  { src: "/images/site/genesis-banner.webp", size: "quarter", title: "GENESIS 2026", line: "Behind the Western 2025–2026 TSI banner.", alt: "The TSI team at GENESIS 2026 behind the Western 2025–2026 TSI banner" },
  { src: "/images/site/genesis-spacewalk.webp", size: "quarter", title: "GENESIS 2026", line: "A project team at their exhibit.", alt: "A project team in TSI hoodies around their exhibit at GENESIS 2026" },
  { src: "/images/site/genesis-redcross.webp", size: "quarter", title: "GENESIS 2026", line: "The Canadian Red Cross project table.", alt: "A project team at their Canadian Red Cross table at GENESIS 2026" },
  { src: "/images/site/genesis-presenting.webp", size: "quarter", title: "GENESIS 2026", line: "Presenting to the room.", alt: "Students presenting to a crowd at GENESIS 2026" },
];

export default function Team() {
  return (
    <section className="ts-section" data-tone="light" id="team" aria-labelledby="team-title">
      <div className="ts-wrap">
        <Reveal delay={0.08}><h2 className="ts-h2" id="team-title" style={{ maxWidth: "15em" }}>150+ members across two chapters.</h2></Reveal>
        <div className="tm-photos">
          {PHOTOS.map((ph, i) => (
            <Reveal as="figure" key={ph.src} className={`tm-photo tm-photo--${ph.size}`} delay={0.06 * (i % 4)} style={{ margin: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ph.src} alt={ph.alt} loading="lazy" />
              <figcaption className="tm-photo__info">
                <b>{ph.title}</b>
                <span>{ph.line}</span>
              </figcaption>
            </Reveal>
          ))}
        </div>

        <div className="tm-window-row">
          <div style={{ display: "grid", gap: 18 }}>
            <Reveal delay={0.06}><h3 className="ts-h2" style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)" }}>Members get an island.</h3></Reveal>
            <Reveal delay={0.12}><p className="ts-body">Tethos Island is our member world: projects, events and the club in one place you walk around in. Join a team to get in.</p></Reveal>
            <Reveal delay={0.16} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/student/apply" className="ts-btn ts-btn--primary">See open roles <span className="ts-btn__arrow">→</span></Link>
              <a href={`${PLAY_ORIGIN}/`} className="ts-btn ts-btn--ghost">Member sign-in</a>
            </Reveal>
          </div>
          <Reveal className="tm-window">
            <div className="tm-window__bar"><span className="tm-window__dots"><i /><i /><i /></span>play.tethos.ca</div>
            <div className="tm-window__screen">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/site/tethos-island.webp" alt="Tethos Island, the member world: a small island with the club's buildings" loading="lazy" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

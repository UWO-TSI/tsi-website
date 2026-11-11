import Link from "next/link";
import Reveal from "@/components/site/Reveal";
import { PLAY_ORIGIN } from "@/lib/hosts";

const PHOTOS = [
  { src: "/images/site/genesis-banner.webp", size: "lead", caption: "GENESIS 2026", alt: "The TSI team at GENESIS 2026 behind the Western 2025–2026 TSI banner" },
  { src: "/images/site/cotty-kayaks.webp", size: "side", caption: "Cotty '26", alt: "Members in kayaks on a river at the club's cottage trip" },
  { src: "/images/site/genesis-spacewalk.webp", size: "quarter", caption: "GENESIS 2026", alt: "A project team in TSI hoodies around their exhibit at GENESIS 2026" },
  { src: "/images/site/genesis-redcross.webp", size: "quarter", caption: "GENESIS 2026", alt: "A project team at their Canadian Red Cross table at GENESIS 2026" },
  { src: "/images/site/genesis-group.webp", size: "quarter", caption: "GENESIS 2026", alt: "Members in TSI hoodies posing together at GENESIS 2026" },
  { src: "/images/site/genesis-presenting.webp", size: "quarter", caption: "GENESIS 2026", alt: "Students presenting to a crowd at GENESIS 2026" },
];

export default function Team() {
  return (
    <section className="ts-section" data-tone="light" id="team" aria-labelledby="team-title">
      <div className="ts-wrap">
        <Reveal><p className="ts-label">The people</p></Reveal>
        <Reveal delay={0.08}><h2 className="ts-h2" id="team-title" style={{ marginTop: 18, maxWidth: "15em" }}>150+ members across two chapters.</h2></Reveal>
        <div className="tm-photos">
          {PHOTOS.map((ph, i) => (
            <Reveal as="figure" key={ph.src} className={`tm-photo tm-photo--${ph.size}`} delay={0.06 * (i % 4)} style={{ margin: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ph.src} alt={ph.alt} loading="lazy" />
              <figcaption>{ph.caption}</figcaption>
            </Reveal>
          ))}
        </div>

        <div className="tm-window-row">
          <div style={{ display: "grid", gap: 18 }}>
            <Reveal><p className="ts-label">For students</p></Reveal>
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

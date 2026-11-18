import Reveal from "@/components/site/Reveal";
import IslandScrub from "@/components/site/home/IslandScrub";

/** Hovering a photo shows what it is. */
const PHOTOS = [
  { src: "/images/site/tsi-team-2026.webp", size: "lead", title: "TSI team, 2026–27", line: "This year's members, together outside.", alt: "The 2026–27 TSI team in navy TSI hoodies, gathered outside behind a TSI banner" },
  { src: "/images/site/tsi-common-grounds.webp", size: "side", title: "TSI × Common Grounds", line: "We made sandwiches to donate to Ark Aid. Our team made 344.", alt: "TSI members in a kitchen behind three bins of sandwiches made for Ark Aid" },
  { src: "/images/site/genesis-banner.webp", size: "quarter", title: "GENESIS 2026", line: "Behind the Western 2025–2026 TSI banner.", alt: "The TSI team at GENESIS 2026 behind the Western 2025–2026 TSI banner" },
  { src: "/images/site/genesis-spacewalk.webp", size: "quarter", title: "GENESIS 2026", line: "A project team at their exhibit.", alt: "A project team in TSI hoodies around their exhibit at GENESIS 2026" },
  { src: "/images/site/genesis-redcross.webp", size: "quarter", title: "GENESIS 2026", line: "The Canadian Red Cross project table.", alt: "A project team at their Canadian Red Cross table at GENESIS 2026" },
  { src: "/images/site/genesis-presenting.webp", size: "quarter", title: "GENESIS 2026", line: "Presenting to the room.", alt: "Students presenting to a crowd at GENESIS 2026" },
];

export default function Team() {
  return (
    <section className="ts-section" data-tone="dark" id="team" aria-labelledby="team-title">
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

        <IslandScrub />
      </div>
    </section>
  );
}

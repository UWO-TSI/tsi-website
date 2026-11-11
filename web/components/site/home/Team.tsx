import Link from "next/link";
import Reveal from "@/components/site/Reveal";
import { PLAY_ORIGIN } from "@/lib/hosts";

export default function Team() {
  return (
    <section className="ts-section" data-tone="light" id="team" aria-labelledby="team-title">
      <div className="ts-wrap">
        <Reveal><p className="ts-label">The people</p></Reveal>
        <Reveal delay={0.08}><h2 className="ts-h2" id="team-title" style={{ marginTop: 18, maxWidth: "15em" }}>150+ members across two chapters.</h2></Reveal>
        <div className="tm-photos">
          <Reveal as="figure" className="tm-photo tm-photo--wide" style={{ margin: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/site/team-2025.webp" alt="The TSI team at Western in matching hoodies, gathered around a Western banner" loading="lazy" />
            <figcaption>TSI Western · Fall 2025</figcaption>
          </Reveal>
          <Reveal as="figure" className="tm-photo tm-photo--side" delay={0.1} style={{ margin: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/flag_signing.webp" alt="A member signing the TSI flag" loading="lazy" />
            <figcaption>Signing the flag</figcaption>
          </Reveal>
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

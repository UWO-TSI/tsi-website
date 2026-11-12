import "../pages.css";
import type { Metadata } from "next";
import Reveal from "@/components/site/Reveal";
import GlyphField from "@/components/site/GlyphField";
import CopyEmail from "@/components/site/contact/CopyEmail";
import { TETHOS } from "@/lib/site/config";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Tethos at info@tethos.ca.",
};

const CONTACT_PHRASE = "SAY HI · INFO@TETHOS.CA · WE READ EVERYTHING · ";
const CONTACT_FIELD = "SAY HI · ";

/** One thing on the page: the address (David, 2026-11-12: "only info@tethos.ca, very clear"). */
export default function ContactPage() {
  return (
    <section className="ts-section gx-hero ct-hero" data-tone="dark" id="contact" aria-labelledby="contact-title">
      <div className="gx-aura" aria-hidden="true" />
      <div className="gx-hero__field" aria-hidden="true">
        <GlyphField src="/images/site/contact-envelope.png" phrase={CONTACT_PHRASE} backgroundPhrase={CONTACT_FIELD} layout="right" avoid=".gx-hero__copy" />
      </div>
      <div className="ts-wrap gx-hero__grid">
        <div className="gx-hero__copy">
          <Reveal delay={0.06}><h1 className="ts-h1 ct-hero__title" id="contact-title">Talk to us.</h1></Reveal>
          <Reveal delay={0.12}><p className="ts-lede">One inbox for everything: nonprofits, sponsors, students, and anyone who wants to start a chapter.</p></Reveal>
          <Reveal delay={0.18}><CopyEmail email={TETHOS.contact} /></Reveal>
          <Reveal delay={0.24}>
            <a href={`mailto:${TETHOS.contact}`} className="ts-btn ts-btn--primary">Email us <span className="ts-btn__arrow">→</span></a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

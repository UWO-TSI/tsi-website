import "../pages.css";
import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/site/Reveal";
import GlyphField from "@/components/site/GlyphField";
import DotNav from "@/components/site/DotNav";
import CopyEmail from "@/components/site/contact/CopyEmail";
import { CoinHandIcon, HeartIcon, PersonIcon, SparkIcon } from "@/components/site/icons";
import { TETHOS } from "@/lib/site/config";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Tethos: one inbox for nonprofits, sponsors, students and anyone who wants to start a chapter.",
};

const mail = (subject: string) => `mailto:${TETHOS.contact}?subject=${encodeURIComponent(subject)}`;

/** Who's writing, and where they should go. */
const ROUTES = [
  { Icon: HeartIcon, who: "Nonprofits", line: "Apply for an 8-month build, or ask about the program.", go: "See the program", href: "/npo" },
  { Icon: CoinHandIcon, who: "Sponsors", line: "Back GENESIS. Judy Gao and Sierra Lin run sponsorship.", go: "Sponsor GENESIS", href: "/genesis#sponsor" },
  { Icon: PersonIcon, who: "Students", line: "Join a team. Hiring runs in September and May.", go: "Find your role", href: "/students" },
  { Icon: SparkIcon, who: "Start a chapter", line: "Bring TSI to your school. Tell us about your campus.", go: "Email us", href: mail("Starting a TSI chapter") },
];

const SECTIONS = [
  { id: "contact", label: "Contact" },
  { id: "routes", label: "Who's writing" },
];

const CONTACT_PHRASE = "SAY HI · INFO@TETHOS.CA · WE READ EVERYTHING · ";
const CONTACT_FIELD = "SAY HI · ";

export default function ContactPage() {
  return (
    <>
      <DotNav sections={SECTIONS} />
      <section className="ts-section gx-hero ct-hero" data-tone="dark" id="contact" aria-labelledby="contact-title">
        <div className="gx-aura" aria-hidden="true" />
        <div className="gx-hero__field" aria-hidden="true">
          <GlyphField src="/images/site/contact-envelope.png" phrase={CONTACT_PHRASE} backgroundPhrase={CONTACT_FIELD} layout="right" />
        </div>
        <div className="ts-wrap gx-hero__grid">
          <div className="gx-hero__copy">
            <Reveal delay={0.06}><h1 className="ts-h1 ct-hero__title" id="contact-title">Talk to us.</h1></Reveal>
            <Reveal delay={0.12}><p className="ts-lede">One inbox for everything. Write to us and a person at Tethos answers.</p></Reveal>
            <Reveal delay={0.18}><CopyEmail email={TETHOS.contact} /></Reveal>
            <Reveal delay={0.24} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href={`mailto:${TETHOS.contact}`} className="ts-btn ts-btn--primary">Email us <span className="ts-btn__arrow">→</span></a>
              <a href="#routes" className="ts-btn ts-btn--ghost">Who are you?</a>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="ts-section ct-routes" data-tone="dark" id="routes" aria-labelledby="routes-title">
        <div className="ts-wrap">
          <Reveal delay={0.06}><h2 className="ts-h2" id="routes-title">Or go straight to the right place.</h2></Reveal>
          <ul className="ct-cards">
            {ROUTES.map(({ Icon, who, line, go, href }, i) => (
              <Reveal as="li" key={who} className="ct-card" delay={0.06 * i}>
                <Link href={href} className="ct-card__link">
                  <span className="ct-card__icon" aria-hidden="true"><Icon size={22} /></span>
                  <h3 className="ts-h3">{who}</h3>
                  <p className="ts-body">{line}</p>
                  <span className="ct-card__go">{go} <span aria-hidden="true">→</span></span>
                </Link>
              </Reveal>
            ))}
          </ul>
          <Reveal delay={0.1}>
            <p className="ct-where">
              <span>Chapters at Western University, London, Ontario and UBC, Vancouver</span>
              <a href={TETHOS.instagram} target="_blank" rel="noopener noreferrer">Instagram ↗</a>
              <a href={TETHOS.github} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}

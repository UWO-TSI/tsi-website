import "../pages.css";
import type { Metadata } from "next";
import Reveal from "@/components/site/Reveal";
import GlyphSeam from "@/components/site/GlyphSeam";
import GlyphField from "@/components/site/GlyphField";
import DotNav from "@/components/site/DotNav";
import NpoApplyForm from "@/components/site/npo/NpoApplyForm";
import NpoTimeline, { type TimelineStop } from "@/components/site/npo/NpoTimeline";
import FaqAscii from "@/components/site/npo/FaqAscii";
import { npoFormOpen, NPO_WINDOW_LABEL } from "@/lib/npo-applications";
import { TETHOS } from "@/lib/site/config";

export const metadata: Metadata = {
  title: "For nonprofits",
  description: "An 8-month build for your organization by a team of student developers, designers and a project manager, at no cost. Applications open Aug 10.",
};

/** The hero's numbers. */
const STATS = [
  { v: "8 months", k: "October to April" },
  { v: "$0", k: "For the build" },
  { v: "2–3 h", k: "Your time a week" },
];

/** The words the ring of people in the hero is written in, and the faint field around it. */
const NPO_PHRASE = "PRO BONO · NONPROFITS · AT NO COST · YOUR TEAM · YOU KEEP THE CODE · OCTOBER TO APRIL · ";
const NPO_FIELD = "PRO BONO · ";

/** What the organization keeps at handoff, shown in the timeline's last stop. */
const KEEP = [
  "Software that works, deployed and tested",
  "The source code and its documentation",
  "Design files and a style guide",
  "Training for your staff",
  "30 days of support after handoff",
  "An impact report for your board and funders",
] as const;

const TIMELINE: TimelineStop[] = [
  { at: 0, when: "Aug", title: "Applications", detail: `Tell us about your organization and what you need. The form is open ${NPO_WINDOW_LABEL}.` },
  { at: 1, when: "Sep", title: "Selection", detail: "We choose the partners where a student team can do the most good." },
  { at: 2, when: "Oct", title: "Kickoff", detail: "Your team meets you, learns how your organization works and agrees on what to build." },
  { at: 2.6, until: 7, when: "Oct–Mar", title: "Build", detail: "Design first, then code, with a demo every two weeks. You see it working long before it's done." },
  { at: 7, when: "Mar", title: "GENESIS", detail: "Your team presents the project at our year-end showcase. You're invited." },
  { at: 8, when: "Apr", title: "Handoff", detail: "Everything transfers to you, and it's yours to keep:", keep: KEEP },
];

const FAQ = [
  { q: "Do we own the code?", a: "Yes. Everything transfers to your organization at handoff. No licensing fees, no strings attached." },
  { q: "How much of our time does it take?", a: "About 2 to 3 hours a week for check-ins and feedback. We need one person on your team the students can reach with questions." },
  { q: "Who can apply?", a: "Registered charities, nonprofits and social enterprises with a clear technology need and a limited budget for custom software." },
  { q: "Is there really no cost?", a: "The build is free: sponsors fund the program. The only costs are the ones that come with running it yourself, like your domain name." },
  { q: "What do you build with?", a: "Whatever fits the project. Most often Next.js, React, Node.js, PostgreSQL and Supabase. We decide together at kickoff." },
  { q: "What happens after the support window?", a: "You have the full source code and documentation. Many organizations keep it running with their own staff or apply again for a follow-up project. We also partner with software companies that will maintain it for you at a discounted rate." },
];

const SECTIONS = [
  { id: "npo-hero", label: "Program" },
  { id: "timeline", label: "Timeline" },
  { id: "questions", label: "Questions" },
  { id: "apply", label: "Apply" },
];

export default function NpoPage() {
  const open = npoFormOpen();
  return (
    <>
      <DotNav sections={SECTIONS} />
      <section className="ts-section gx-hero np-hero" data-tone="dark" id="npo-hero" aria-labelledby="npo-title">
        <div className="gx-aura" aria-hidden="true" />
        <div className="gx-hero__field" aria-hidden="true">
          <GlyphField src="/images/site/npo-ring.png" phrase={NPO_PHRASE} backgroundPhrase={NPO_FIELD} layout="right" />
        </div>
        <div className="ts-wrap gx-hero__grid">
          <div className="gx-hero__copy">
            <Reveal delay={0.06}><h1 className="ts-h1 np-hero__title" id="npo-title">An 8-month build for your organization, at no cost.</h1></Reveal>
            <Reveal delay={0.12}><p className="ts-lede">A team of student developers and designers, led by a project manager, works with you from October to April. You keep everything they build.</p></Reveal>
            <Reveal delay={0.18}>
              <dl className="gx-stats">
                {STATS.map((s) => (
                  <div key={s.k}><dt className="ts-label">{s.k}</dt><dd className="ts-num">{s.v}</dd></div>
                ))}
              </dl>
            </Reveal>
            <Reveal delay={0.24} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="#apply" className="ts-btn ts-btn--primary">{open ? "Apply now" : "Apply from Aug 10"} <span className="ts-btn__arrow">→</span></a>
              <a href="#timeline" className="ts-btn ts-btn--ghost">How it works</a>
            </Reveal>
          </div>
        </div>
      </section>

      <NpoTimeline title="Eight months, step by step." stops={TIMELINE} />

      <section className="ts-section np-questions" data-tone="dark" id="questions" aria-labelledby="questions-title">
        <div className="ts-wrap">
          <Reveal delay={0.06}><h2 className="ts-h2" id="questions-title">Before you apply</h2></Reveal>
          <Reveal delay={0.08}><p className="np-questions__hint">Click a question to open it.</p></Reveal>
          <Reveal delay={0.1}><FaqAscii items={FAQ} /></Reveal>
        </div>
      </section>

      <GlyphSeam from="dark" to="light" seed={15} />
      <section className="ts-section np-apply-section" data-tone="light" id="apply" aria-labelledby="apply-title">
        <div className="ts-wrap np-apply np-apply--one">
          <div className="np-apply__intro">
            <h2 className="ts-h2" id="apply-title">{open ? "Tell us what you need." : "Applications open Aug 10."}</h2>
            <p className="ts-body" style={{ marginTop: 18 }}>
              {open
                ? "We choose partners in September."
                : `The form opens ${NPO_WINDOW_LABEL}. Until then, questions go to `}
              {!open && <a href={`mailto:${TETHOS.contact}`} style={{ color: "var(--signal-light)" }}>{TETHOS.contact}</a>}
              {!open && "."}
            </p>
          </div>
          {open ? <NpoApplyForm contact={TETHOS.contact} /> : null}
        </div>
      </section>
    </>
  );
}

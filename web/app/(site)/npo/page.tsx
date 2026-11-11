import "../pages.css";
import "../home.css";
import type { Metadata } from "next";
import RollingRows from "@/components/site/RollingRows";
import Faq from "@/components/site/Faq";
import Reveal from "@/components/site/Reveal";
import GlyphSeam from "@/components/site/GlyphSeam";
import DotNav from "@/components/site/DotNav";
import NpoApplyForm from "@/components/site/npo/NpoApplyForm";
import { npoFormOpen, NPO_WINDOW_LABEL } from "@/lib/npo-applications";
import { TETHOS } from "@/lib/site/config";

export const metadata: Metadata = {
  title: "For nonprofits",
  description: "An 8-month build for your organization by a team of student developers, designers and a project manager, at no cost. Applications open Aug 10.",
};

const FACTS = [
  { k: "Length", v: "8 months, October to April" },
  { k: "Cost", v: "$0" },
  { k: "Your time", v: "2 to 3 hours a week" },
  { k: "You keep", v: "The code, the designs and the docs" },
  { k: "Applications", v: NPO_WINDOW_LABEL },
];

const TIMELINE = [
  { when: "Aug", title: "Applications", detail: `Tell us about your organization and what you need. The form is open ${NPO_WINDOW_LABEL}.` },
  { when: "Sep", title: "Selection", detail: "We choose the partners where a student team can do the most good." },
  { when: "Oct", title: "Kickoff", detail: "Your team meets you, learns how your organization works and agrees on what to build." },
  { when: "Oct–Mar", title: "Build", detail: "Design first, then code, with a demo every two weeks. You see it working long before it's done." },
  { when: "Mar", title: "GENESIS", detail: "Your team presents the project at our year-end showcase. You're invited." },
  { when: "Apr", title: "Handoff", detail: "Training, documentation and the code, then a 30-day support window." },
];

const DELIVERABLES = [
  { title: "Software that works", line: "Deployed, tested and ready for your users." },
  { title: "The source code", line: "The full codebase with technical documentation." },
  { title: "Design files", line: "Figma files and a style guide." },
  { title: "Training", line: "Hands-on sessions so your staff can run it." },
  { title: "A support window", line: "30 days of bug fixes and answers after handoff." },
  { title: "An impact report", line: "What was built and what it changed, for your board and funders." },
];

const FAQ = [
  { q: "Do we own the code?", a: "Yes. Everything transfers to your organization at handoff. No licensing fees, no strings attached." },
  { q: "How much of our time does it take?", a: "About 2 to 3 hours a week for check-ins and feedback. We need one person on your team the students can reach with questions." },
  { q: "Who can apply?", a: "Registered charities, nonprofits and social enterprises with a clear technology need and a limited budget for custom software." },
  { q: "Is there really no cost?", a: "None. Sponsors fund the program. Students get real experience, and your organization gets working software." },
  { q: "What do you build with?", a: "Whatever fits the project. Most often Next.js, React, Node.js, PostgreSQL and Supabase. We decide together at kickoff." },
  { q: "What happens after the support window?", a: "You have the full source code and documentation. Many organizations keep it running with their own staff or apply again for a follow-up project." },
];

const SECTIONS = [
  { id: "npo-hero", label: "Program" },
  { id: "timeline", label: "Timeline" },
  { id: "deliverables", label: "What you get" },
  { id: "cost", label: "Cost" },
  { id: "questions", label: "Questions" },
  { id: "apply", label: "Apply" },
];

export default function NpoPage() {
  const open = npoFormOpen();
  return (
    <>
      <DotNav sections={SECTIONS} />
      <section className="ts-section np-hero" data-tone="dark" id="npo-hero">
        <div className="ts-wrap np-hero__grid">
          <div className="np-hero__copy">
            <Reveal delay={0.06}><h1 className="ts-h1" style={{ fontSize: "clamp(2.5rem, 5.6vw, 5rem)" }}>An 8-month build for your organization, at no cost.</h1></Reveal>
            <Reveal delay={0.12}><p className="ts-lede">A team of student developers and designers, led by a project manager, works with you from October to April. You keep everything they build.</p></Reveal>
            <Reveal delay={0.18} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="#apply" className="ts-btn ts-btn--primary">{open ? "Apply now" : "Apply from Aug 10"} <span className="ts-btn__arrow">→</span></a>
              <a href="#timeline" className="ts-btn ts-btn--ghost">How it works</a>
            </Reveal>
          </div>
          <Reveal as="dl" className="np-facts" delay={0.2}>
            {FACTS.map((f) => (
              <div key={f.k} className="np-facts__row">
                <dt className="ts-label">{f.k}</dt>
                <dd>{f.v}</dd>
              </div>
            ))}
          </Reveal>
        </div>
      </section>
      <GlyphSeam from="dark" to="light" seed={11} />
      <RollingRows id="timeline" title="Eight months, step by step." rows={TIMELINE} />
      <GlyphSeam from="light" to="dark" seed={12} />
      <section className="ts-section" data-tone="dark" id="deliverables" aria-labelledby="deliverables-title">
        <div className="ts-wrap">
          <Reveal delay={0.06}><h2 className="ts-h2" id="deliverables-title" style={{ maxWidth: "14em" }}>Everything you need to run it yourself.</h2></Reveal>
          <ol className="np-list">
            {DELIVERABLES.map((d, i) => (
              <Reveal as="li" key={d.title} className="np-list__item" delay={0.05 * i}>
                <span className="np-list__num">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="ts-h3">{d.title}</h3>
                <p className="ts-body">{d.line}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>
      <GlyphSeam from="dark" to="light" seed={13} />
      <section className="ts-section" data-tone="light" id="cost" aria-labelledby="cost-title">
        <div className="ts-wrap">
          <Reveal delay={0.06}><h2 className="ts-h2" id="cost-title" style={{ maxWidth: "14em" }}>Sponsors pay for the program, so you don&apos;t.</h2></Reveal>
          <Reveal className="ticket" delay={0.1}>
            <div className="ticket__price">
              <span className="ts-label">Cost to your organization</span>
              <span className="ticket__amount ts-num">$0</span>
            </div>
            <ol className="ticket__list">
              {DELIVERABLES.map((d, i) => (
                <li key={d.title}><span className="ticket__num">{String(i + 1).padStart(2, "0")}</span>{d.title}</li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>
      <GlyphSeam from="light" to="dark" seed={14} />
      <section className="ts-section" data-tone="dark" id="questions" aria-labelledby="questions-title">
        <div className="ts-wrap np-faq">
          <div>
            <h2 className="ts-h2" id="questions-title">Before you apply</h2>
          </div>
          <Faq items={FAQ} />
        </div>
      </section>
      <GlyphSeam from="dark" to="light" seed={15} />
      <section className="ts-section" data-tone="light" id="apply" aria-labelledby="apply-title">
        <div className="ts-wrap np-apply">
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

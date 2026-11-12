import Link from "next/link";
import Reveal from "@/components/site/Reveal";

/** The last call, for students: the page's one white section, at the end (David cut the closing globe and its circle). */
export default function Closing() {
  return (
    <section className="ts-section cl" data-tone="light" id="join" aria-labelledby="join-title">
      <div className="ts-wrap cl__inner">
        <Reveal delay={0.06}><h2 className="cl__title" id="join-title">Build with us.</h2></Reveal>
        <Reveal delay={0.12}>
          <p className="ts-lede" style={{ textAlign: "center", margin: "0 auto" }}>
            {"Hiring runs in September for project managers, developers and directors, and in May for next year's leadership. Every role starts in the applicant portal."}
          </p>
        </Reveal>
        <Reveal delay={0.18}><Link href="/student/apply" className="ts-btn ts-btn--primary">See open roles <span className="ts-btn__arrow">→</span></Link></Reveal>
      </div>
    </section>
  );
}
